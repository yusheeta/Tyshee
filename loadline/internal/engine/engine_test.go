package engine_test

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/yusheeta/tyshee/loadline/internal/audit"
	"github.com/yusheeta/tyshee/loadline/internal/engine"
	"github.com/yusheeta/tyshee/loadline/internal/testdb"
)

const dollar = 1_000_000 // micro-credits

type fixture struct {
	t      *testing.T
	db     *testdb.DB
	svc    *engine.Service
	tenant int64
	keys   atomic.Int64
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	d := testdb.New(t)
	svc := engine.New(d.DB)
	tenant, err := svc.CreateTenant(context.Background(), "acme")
	if err != nil {
		t.Fatal(err)
	}
	return &fixture{t: t, db: d, svc: svc, tenant: tenant}
}

// key returns a fresh idempotency key.
func (f *fixture) key() string { return fmt.Sprintf("k-%d", f.keys.Add(1)) }

func (f *fixture) node(parent *engine.Node, name string, limit, overdraft int64) engine.Node {
	f.t.Helper()
	spec := engine.NodeSpec{Name: name, Period: engine.Monthly, LimitMicros: limit, OverdraftMicros: overdraft}
	if parent != nil {
		spec.ParentID = &parent.ID
	}
	n, err := f.svc.CreateNode(context.Background(), f.tenant, spec)
	if err != nil {
		f.t.Fatalf("create node %s: %v", name, err)
	}
	return n
}

func (f *fixture) reserve(leaf engine.Node, amount int64, ttl int) engine.Reservation {
	f.t.Helper()
	r, err := f.svc.Reserve(context.Background(), f.tenant, f.key(),
		engine.ReserveRequest{LeafNodeID: leaf.ID, Amount: amount, TTLSeconds: ttl})
	if err != nil {
		f.t.Fatalf("reserve: %v", err)
	}
	return r
}

func (f *fixture) balance(n engine.Node) engine.Balance {
	f.t.Helper()
	bs, err := f.svc.Balances(context.Background(), f.tenant, n.ID)
	if err != nil {
		f.t.Fatal(err)
	}
	return bs[len(bs)-1]
}

// mustAudit fails the test if the auditor finds any violation.
func (f *fixture) mustAudit() {
	f.t.Helper()
	vs, err := audit.Run(context.Background(), f.db.System, nil)
	if err != nil {
		f.t.Fatalf("audit: %v", err)
	}
	for _, v := range vs {
		f.t.Errorf("audit violation: %s", v)
	}
}

// Must-have test 1: 1,200 concurrent attempts against a tree whose binding
// limit admits exactly 600 grant exactly 600, with zero deadlocks.
func TestConcurrentReservesAdmitExactly600(t *testing.T) {
	f := newFixture(t)
	org := f.node(nil, "acme", 600*dollar, 0)
	pa := f.node(&org, "support", 400*dollar, 0)
	pb := f.node(&org, "search", 400*dollar, 0)
	agents := []engine.Node{
		f.node(&pa, "triage", 300*dollar, 0), f.node(&pa, "drafter", 300*dollar, 0),
		f.node(&pb, "ranker", 300*dollar, 0), f.node(&pb, "summarizer", 300*dollar, 0),
	}
	// Agents allow 1,200 and projects 800 in total, so the org (600) binds.
	deadlocksBefore := f.db.Deadlocks(t)

	var granted, rejected atomic.Int64
	var wg sync.WaitGroup
	errs := make(chan error, 1200)
	for i := 0; i < 1200; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := f.svc.Reserve(context.Background(), f.tenant, fmt.Sprintf("c-%d", i),
				engine.ReserveRequest{LeafNodeID: agents[i%4].ID, Amount: dollar})
			switch {
			case err == nil:
				granted.Add(1)
			case engine.IsCode(err, engine.CodeBudgetExceeded):
				rejected.Add(1)
			default:
				errs <- err
			}
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Errorf("unexpected error: %v", err)
	}
	if granted.Load() != 600 || rejected.Load() != 600 {
		t.Fatalf("granted %d, rejected %d; want 600 and 600", granted.Load(), rejected.Load())
	}
	if b := f.balance(org); b.Held != 600*dollar || b.Headroom() != 0 {
		t.Errorf("org balance %+v, want held 600 and no headroom", b)
	}
	if d := f.db.Deadlocks(t) - deadlocksBefore; d != 0 {
		t.Errorf("postgres reported %d deadlocks", d)
	}
	f.mustAudit()
}

// Must-have test 2: 30 concurrent duplicates with one key make one
// reservation, and every caller gets the same result.
func TestConcurrentDuplicatesCreateOneReservation(t *testing.T) {
	f := newFixture(t)
	org := f.node(nil, "acme", 100*dollar, 0)
	agent := f.node(&org, "agent", 50*dollar, 0)

	ids := make([]int64, 30)
	var wg sync.WaitGroup
	for i := range ids {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			r, err := f.svc.Reserve(context.Background(), f.tenant, "same-key",
				engine.ReserveRequest{LeafNodeID: agent.ID, Amount: 3 * dollar})
			if err != nil {
				t.Errorf("duplicate %d: %v", i, err)
				return
			}
			ids[i] = r.ID
		}(i)
	}
	wg.Wait()
	for _, id := range ids {
		if id != ids[0] {
			t.Fatalf("duplicates returned different reservations: %v", ids)
		}
	}
	if b := f.balance(org); b.Held != 3*dollar {
		t.Errorf("org held %d, want one hold of 3 dollars", b.Held)
	}
	var n int
	if err := f.db.System.QueryRow(context.Background(), "SELECT count(*) FROM reservations").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("%d reservations exist, want 1", n)
	}
	f.mustAudit()
}

func TestIdempotencyReplaysAndRejectsReuse(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	org := f.node(nil, "acme", 10*dollar, 0)

	// A different body under the same key is rejected.
	if _, err := f.svc.Reserve(ctx, f.tenant, "k1", engine.ReserveRequest{LeafNodeID: org.ID, Amount: dollar}); err != nil {
		t.Fatal(err)
	}
	_, err := f.svc.Reserve(ctx, f.tenant, "k1", engine.ReserveRequest{LeafNodeID: org.ID, Amount: 2 * dollar})
	if !engine.IsCode(err, engine.CodeIdempotencyMismatch) {
		t.Fatalf("reused key with a different body: got %v, want %s", err, engine.CodeIdempotencyMismatch)
	}
	// The same key on a different endpoint is rejected too.
	_, err = f.svc.Release(ctx, f.tenant, "k1", engine.ReleaseRequest{ReservationID: 1})
	if !engine.IsCode(err, engine.CodeIdempotencyMismatch) {
		t.Fatalf("reused key on another endpoint: got %v", err)
	}

	// A 402 is a result too: the retry replays it even after budget frees up.
	_, err = f.svc.Reserve(ctx, f.tenant, "big", engine.ReserveRequest{LeafNodeID: org.ID, Amount: 50 * dollar})
	if !engine.IsCode(err, engine.CodeBudgetExceeded) {
		t.Fatalf("got %v, want budget_exceeded", err)
	}
	e, _ := engine.AsError(err)
	if e.NodeID != org.ID || e.HeadroomMicros == nil || *e.HeadroomMicros != 9*dollar {
		t.Errorf("402 should name node %d with 9 dollars headroom, got %+v", org.ID, e)
	}
	_, err = f.svc.Reserve(ctx, f.tenant, "big", engine.ReserveRequest{LeafNodeID: org.ID, Amount: 50 * dollar})
	if !engine.IsCode(err, engine.CodeBudgetExceeded) {
		t.Fatalf("replayed 402: got %v", err)
	}
	f.mustAudit()
}

func TestRejectionNamesMostSpecificNode(t *testing.T) {
	f := newFixture(t)
	org := f.node(nil, "acme", 100*dollar, 0)
	proj := f.node(&org, "support", 100*dollar, 0)
	agent := f.node(&proj, "triage", 5*dollar, 0)
	_, err := f.svc.Reserve(context.Background(), f.tenant, f.key(),
		engine.ReserveRequest{LeafNodeID: agent.ID, Amount: 6 * dollar})
	e, ok := engine.AsError(err)
	if !ok || e.Status != 402 || e.NodeID != agent.ID {
		t.Fatalf("got %v, want 402 naming agent %d", err, agent.ID)
	}
	// Nothing was held anywhere.
	for _, n := range []engine.Node{org, proj, agent} {
		if b := f.balance(n); b.Held != 0 {
			t.Errorf("node %s held %d after a rejected reserve", n.Name, b.Held)
		}
	}
}

func TestSettleBelowAndAboveHold(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	org := f.node(nil, "acme", 10*dollar, 2*dollar) // limit 10, overdraft 2
	agent := f.node(&org, "agent", 100*dollar, 0)

	// Below the hold: the rest returns to available.
	r := f.reserve(agent, 5*dollar, 0)
	r, err := f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: 3 * dollar})
	if err != nil || r.State != engine.Settled || *r.SettledAmount != 3*dollar {
		t.Fatalf("settle: %+v, %v", r, err)
	}
	if b := f.balance(org); b.Held != 0 || b.Consumed != 3*dollar || b.Headroom() != 9*dollar {
		t.Fatalf("after settle below hold: %+v", b)
	}

	// Above the hold, past limit + overdraft: recorded in full, the excess
	// becomes overrun and the node freezes.
	r = f.reserve(agent, 5*dollar, 0)
	if _, err := f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: 11 * dollar}); err != nil {
		t.Fatal(err)
	}
	b := f.balance(org)
	if b.Consumed != 14*dollar || b.Overrun != 2*dollar || !b.Frozen {
		t.Fatalf("after overrun: %+v, want consumed 14, overrun 2, frozen", b)
	}
	_, err = f.svc.Reserve(ctx, f.tenant, f.key(), engine.ReserveRequest{LeafNodeID: agent.ID, Amount: 1})
	if !engine.IsCode(err, engine.CodeNodeFrozen) {
		t.Fatalf("reserve on a frozen tree: got %v, want node_frozen", err)
	}

	// A duplicate settle with the same amount (new key) returns the same
	// result; a different amount is a conflict.
	if _, err := f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: 11 * dollar}); err != nil {
		t.Errorf("duplicate settle: %v", err)
	}
	_, err = f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: 12 * dollar})
	if !engine.IsCode(err, engine.CodeAmountMismatch) {
		t.Errorf("settle with a new amount: got %v, want %s", err, engine.CodeAmountMismatch)
	}
	f.mustAudit()
}

func TestReleaseAndExtend(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	org := f.node(nil, "acme", 10*dollar, 0)

	r := f.reserve(org, 4*dollar, 5)
	ext, err := f.svc.Extend(ctx, f.tenant, f.key(), engine.ExtendRequest{ReservationID: r.ID, TTLSeconds: 600})
	if err != nil || !ext.ExpiresAt.After(r.ExpiresAt) {
		t.Fatalf("extend: %+v, %v", ext, err)
	}
	if ext.ExpiresAt.After(ext.MaxExpiresAt) {
		t.Errorf("extend passed the max lifetime")
	}
	rel, err := f.svc.Release(ctx, f.tenant, f.key(), engine.ReleaseRequest{ReservationID: r.ID})
	if err != nil || rel.State != engine.Released {
		t.Fatalf("release: %+v, %v", rel, err)
	}
	if b := f.balance(org); b.Held != 0 || b.Headroom() != 10*dollar {
		t.Errorf("after release: %+v", b)
	}
	// Releasing again is harmless; settling or extending a released hold is not.
	if _, err := f.svc.Release(ctx, f.tenant, f.key(), engine.ReleaseRequest{ReservationID: r.ID}); err != nil {
		t.Errorf("second release: %v", err)
	}
	if _, err := f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: 1}); !engine.IsCode(err, engine.CodeInvalidState) {
		t.Errorf("settle after release: got %v", err)
	}
	if _, err := f.svc.Extend(ctx, f.tenant, f.key(), engine.ExtendRequest{ReservationID: r.ID, TTLSeconds: 5}); !engine.IsCode(err, engine.CodeInvalidState) {
		t.Errorf("extend after release: got %v", err)
	}
	f.mustAudit()
}

func TestExpiryAndLateSettle(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	org := f.node(nil, "acme", 10*dollar, 0)

	r := f.reserve(org, 8*dollar, 1)
	time.Sleep(1100 * time.Millisecond)
	if _, err := f.svc.Extend(ctx, f.tenant, f.key(), engine.ExtendRequest{ReservationID: r.ID, TTLSeconds: 5}); !engine.IsCode(err, engine.CodeExpired) {
		t.Fatalf("extend after expiry: got %v, want %s", err, engine.CodeExpired)
	}
	n, err := f.svc.SweepExpired(ctx, 100)
	if err != nil || n != 1 {
		t.Fatalf("sweep: %d, %v", n, err)
	}
	if b := f.balance(org); b.Held != 0 {
		t.Fatalf("held %d after expiry", b.Held)
	}
	// Spend the freed budget, then the late settle arrives: it is charged in
	// full, the excess is overrun, and the node freezes.
	f.reserve(org, 9*dollar, 0)
	late, err := f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: 7 * dollar})
	if err != nil {
		t.Fatal(err)
	}
	if late.State != engine.Expired || late.LateSettledAmount == nil || *late.LateSettledAmount != 7*dollar {
		t.Fatalf("late settle: %+v", late)
	}
	b := f.balance(org)
	if b.Consumed != 7*dollar || b.Overrun != 6*dollar || !b.Frozen {
		t.Fatalf("after late settle: %+v, want consumed 7, overrun 6, frozen", b)
	}
	// Retrying the late settle is safe; a different amount is not.
	if _, err := f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: 7 * dollar}); err != nil {
		t.Errorf("repeat late settle: %v", err)
	}
	if _, err := f.svc.Settle(ctx, f.tenant, f.key(), engine.SettleRequest{ReservationID: r.ID, Amount: dollar}); !engine.IsCode(err, engine.CodeAmountMismatch) {
		t.Errorf("late settle with a new amount: got %v", err)
	}
	f.mustAudit()
}

// Must-have test 3: 300 settles racing the sweeper all end valid: each
// reservation is either SETTLED, or EXPIRED with its late settle recorded,
// and the ledger balances.
func TestSettlesRacingSweeperAllEndValid(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	org := f.node(nil, "acme", 10_000*dollar, 0)
	proj := f.node(&org, "support", 10_000*dollar, 0)
	agent := f.node(&proj, "triage", 10_000*dollar, 0)
	deadlocksBefore := f.db.Deadlocks(t)

	rs := make([]engine.Reservation, 300)
	for i := range rs {
		rs[i] = f.reserve(agent, 2*dollar, 1)
	}
	time.Sleep(time.Until(rs[len(rs)-1].ExpiresAt) + 50*time.Millisecond)

	var wg sync.WaitGroup
	stop := make(chan struct{})
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
				}
				if _, err := f.svc.SweepExpired(ctx, 20); err != nil {
					t.Errorf("sweep: %v", err)
					return
				}
			}
		}()
	}
	var settlers sync.WaitGroup
	for i := range rs {
		settlers.Add(1)
		go func(i int) {
			defer settlers.Done()
			if _, err := f.svc.Settle(ctx, f.tenant, fmt.Sprintf("s-%d", i),
				engine.SettleRequest{ReservationID: rs[i].ID, Amount: dollar}); err != nil {
				t.Errorf("settle %d: %v", i, err)
			}
		}(i)
	}
	settlers.Wait()
	close(stop)
	wg.Wait()

	var settled, lateSettled int
	for _, r := range rs {
		got, err := f.svc.GetReservation(ctx, f.tenant, r.ID)
		if err != nil {
			t.Fatal(err)
		}
		switch {
		case got.State == engine.Settled && *got.SettledAmount == dollar:
			settled++
		case got.State == engine.Expired && got.LateSettledAmount != nil && *got.LateSettledAmount == dollar:
			lateSettled++
		default:
			t.Errorf("reservation %d ended invalid: %+v", r.ID, got)
		}
	}
	t.Logf("settled %d, expired then late-settled %d", settled, lateSettled)
	if b := f.balance(org); b.Held != 0 || b.Consumed != 300*dollar {
		t.Errorf("org %+v, want held 0 and consumed 300", b)
	}
	if d := f.db.Deadlocks(t) - deadlocksBefore; d != 0 {
		t.Errorf("postgres reported %d deadlocks", d)
	}
	f.mustAudit()
}

func TestTenantIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	orgA := f.node(nil, "acme", 10*dollar, 0)
	other, err := f.svc.CreateTenant(ctx, "globex")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.svc.GetNode(ctx, other, orgA.ID); !engine.IsCode(err, engine.CodeNotFound) {
		t.Errorf("tenant B read tenant A's node: %v", err)
	}
	_, err = f.svc.Reserve(ctx, other, "x", engine.ReserveRequest{LeafNodeID: orgA.ID, Amount: 1})
	if !engine.IsCode(err, engine.CodeNotFound) {
		t.Errorf("tenant B reserved on tenant A's node: %v", err)
	}
	r := f.reserve(orgA, dollar, 0)
	if _, err := f.svc.GetReservation(ctx, other, r.ID); !engine.IsCode(err, engine.CodeNotFound) {
		t.Errorf("tenant B read tenant A's reservation: %v", err)
	}
	// Without app.tenant_id the app role sees nothing at all: it fails closed.
	var n int
	err = f.db.App.QueryRow(ctx, "SELECT count(*) FROM budget_nodes").Scan(&n)
	if err == nil {
		t.Errorf("app role read budget_nodes without a tenant set (%d rows)", n)
	}
}

func TestBudgetTreeDepthLimit(t *testing.T) {
	f := newFixture(t)
	n := f.node(nil, "l1", dollar, 0)
	for i := 2; i <= engine.MaxDepth; i++ {
		n = f.node(&n, fmt.Sprintf("l%d", i), dollar, 0)
	}
	_, err := f.svc.CreateNode(context.Background(), f.tenant,
		engine.NodeSpec{ParentID: &n.ID, Name: "l5", Period: engine.Monthly, LimitMicros: dollar})
	if !engine.IsCode(err, engine.CodeValidation) {
		t.Fatalf("fifth level: got %v, want validation error", err)
	}
}
