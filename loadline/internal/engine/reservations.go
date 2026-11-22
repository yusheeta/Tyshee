package engine

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// ReserveRequest asks to hold Amount on a leaf node and every ancestor.
type ReserveRequest struct {
	LeafNodeID int64 `json:"leaf_node_id"`
	Amount     int64 `json:"amount_micros"`
	// TTLSeconds is how long the hold lives without an extend. Zero means
	// DefaultTTL.
	TTLSeconds int `json:"ttl_seconds,omitempty"`
}

// Reserve atomically holds the amount at every level of the leaf's path, or
// at none. It returns a 402 *Error naming the most specific node that lacks
// headroom.
func (s *Service) Reserve(ctx context.Context, tenantID int64, idemKey string, req ReserveRequest) (Reservation, error) {
	if req.Amount <= 0 {
		return Reservation{}, validation("amount_micros must be positive")
	}
	ttl := DefaultTTL
	if req.TTLSeconds != 0 {
		ttl = time.Duration(req.TTLSeconds) * time.Second
		if req.TTLSeconds < 1 || ttl > MaxTTL {
			return Reservation{}, validation("ttl_seconds must be between 1 and %d", int(MaxTTL/time.Second))
		}
	}
	for attempt := 0; ; attempt++ {
		r, err := runIdem(ctx, s, tenantID, idemKey, "reserve", 201, req, func(tx pgx.Tx) (Reservation, error) {
			return reserveTx(ctx, tx, tenantID, req, ttl)
		})
		if errors.Is(err, errPeriodMissing) && attempt < 3 {
			// Open the period in its own short transaction, then retry.
			if err := s.openPeriods(ctx, tenantID, req.LeafNodeID); err != nil {
				return Reservation{}, err
			}
			continue
		}
		return r, err
	}
}

// reserveTx is the reserve transaction (docs/transactions.md, T1).
func reserveTx(ctx context.Context, tx pgx.Tx, tenantID int64, req ReserveRequest, ttl time.Duration) (Reservation, error) {
	path, now, err := nodePath(ctx, tx, req.LeafNodeID)
	if err != nil {
		return Reservation{}, err
	}
	ids, periods, err := pathPeriods(ctx, tx, path, now)
	if err != nil {
		return Reservation{}, err
	}
	// Lock every node on the path, ascending node_id.
	bals, err := lockBalances(ctx, tx, ids, periods)
	if err != nil {
		return Reservation{}, err
	}
	if len(bals) != len(path) {
		return Reservation{}, errPeriodMissing
	}
	byNode := make(map[int64]*lockedBalance, len(bals))
	for _, b := range bals {
		byNode[b.NodeID] = b
	}
	// Check headroom from the leaf up, so the error names the most specific
	// node that blocked the request.
	for i := len(path) - 1; i >= 0; i-- {
		b := byNode[path[i]]
		if b.Frozen {
			return Reservation{}, nodeFrozen(b.NodeID)
		}
		if h := b.Headroom(); h < req.Amount {
			return Reservation{}, budgetExceeded(b.NodeID, h, req.Amount)
		}
	}
	for _, b := range bals {
		b.Held += req.Amount
	}
	if err := writeBalances(ctx, tx, bals); err != nil {
		return Reservation{}, err
	}

	r := Reservation{TenantID: tenantID, LeafNodeID: req.LeafNodeID, Amount: req.Amount, State: Held}
	err = tx.QueryRow(ctx, `
		INSERT INTO reservations (tenant_id, leaf_node_id, amount, expires_at, max_expires_at)
		VALUES ($1, $2, $3, now() + $4 * interval '1 second', now() + $5 * interval '1 second')
		RETURNING id, expires_at, max_expires_at, created_at, updated_at`,
		tenantID, req.LeafNodeID, req.Amount, ttl.Seconds(), MaxLifetime.Seconds()).Scan(
		&r.ID, &r.ExpiresAt, &r.MaxExpiresAt, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return Reservation{}, err
	}
	amounts := make([]int64, len(ids))
	for i := range amounts {
		amounts[i] = req.Amount
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO reservation_holds (reservation_id, tenant_id, node_id, period_start, amount)
		SELECT $1, $2, h.node_id, h.period_start, h.amount
		  FROM unnest($3::bigint[], $4::timestamptz[], $5::bigint[]) AS h(node_id, period_start, amount)`,
		r.ID, tenantID, ids, periods, amounts); err != nil {
		return Reservation{}, err
	}
	entries := make([]entry, 0, 2*len(bals))
	for _, b := range bals {
		entries = append(entries, entry{b.availAcct, -req.Amount}, entry{b.heldAcct, req.Amount})
		r.Holds = append(r.Holds, Hold{NodeID: b.NodeID, PeriodStart: b.PeriodStart.UTC(), Amount: req.Amount})
	}
	if err := post(ctx, tx, tenantID, "reserve", &r.ID, entries); err != nil {
		return Reservation{}, err
	}
	normalizeTimes(&r)
	return r, nil
}

// SettleRequest charges the actual cost of a reserved call.
type SettleRequest struct {
	ReservationID int64 `json:"reservation_id"`
	Amount        int64 `json:"amount_micros"`
}

// Settle moves a HELD reservation to SETTLED and charges the actual amount
// on every node of its path. Any unused part returns to available; any part
// above the hold draws on available, then overdraft, and past that is
// recorded as overrun and freezes the node. A settle that arrives after the
// sweeper expired the hold is recorded as a late settle (overrun if past the
// limit); the reservation stays EXPIRED.
func (s *Service) Settle(ctx context.Context, tenantID int64, idemKey string, req SettleRequest) (Reservation, error) {
	if req.Amount < 0 {
		return Reservation{}, validation("amount_micros must be zero or positive")
	}
	return runIdem(ctx, s, tenantID, idemKey, "settle", 200, req, func(tx pgx.Tx) (Reservation, error) {
		return settleTx(ctx, tx, req.ReservationID, req.Amount)
	})
}

func settleTx(ctx context.Context, tx pgx.Tx, id, actual int64) (Reservation, error) {
	var tenantID, amount int64
	err := tx.QueryRow(ctx, `
		UPDATE reservations SET state = 'SETTLED', settled_amount = $2, updated_at = now()
		 WHERE id = $1 AND state = 'HELD'
		RETURNING tenant_id, amount`, id, actual).Scan(&tenantID, &amount)
	if errors.Is(err, pgx.ErrNoRows) {
		// Lost the race, or not HELD to begin with: take the matching path.
		r, err := loadReservation(ctx, tx, id)
		if err != nil {
			return Reservation{}, err
		}
		switch r.State {
		case Settled:
			if *r.SettledAmount == actual {
				return *r, nil // duplicate settle: same result
			}
			return Reservation{}, amountMismatch(id, *r.SettledAmount, actual)
		case Expired:
			return lateSettleTx(ctx, tx, r, actual)
		default:
			return Reservation{}, invalidState(id, r.State, "settled")
		}
	}
	if err != nil {
		return Reservation{}, err
	}
	bals, err := lockHolds(ctx, tx, id)
	if err != nil {
		return Reservation{}, err
	}
	entries := make([]entry, 0, 3*len(bals))
	for _, b := range bals {
		b.Held -= b.holdAmount
		b.Consumed += actual
		chargeOverrun(b.lockedBalance)
		entries = append(entries,
			entry{b.heldAcct, -b.holdAmount}, entry{b.consAcct, actual}, entry{b.availAcct, b.holdAmount - actual})
	}
	if err := writeBalances(ctx, tx, bals.balances()); err != nil {
		return Reservation{}, err
	}
	if err := post(ctx, tx, tenantID, "settle", &id, entries); err != nil {
		return Reservation{}, err
	}
	r, err := loadReservation(ctx, tx, id)
	if err != nil {
		return Reservation{}, err
	}
	return *r, nil
}

// lateSettleTx records usage reported after the hold expired. The money was
// spent upstream, so it is charged in full; whatever lands past the limit is
// overrun and freezes the node.
func lateSettleTx(ctx context.Context, tx pgx.Tx, r *Reservation, actual int64) (Reservation, error) {
	tag, err := tx.Exec(ctx, `
		INSERT INTO late_settles (reservation_id, tenant_id, amount) VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING`, r.ID, r.TenantID, actual)
	if err != nil {
		return Reservation{}, err
	}
	if tag.RowsAffected() == 0 {
		var prev int64
		if err := tx.QueryRow(ctx, "SELECT amount FROM late_settles WHERE reservation_id = $1", r.ID).Scan(&prev); err != nil {
			return Reservation{}, err
		}
		if prev != actual {
			return Reservation{}, amountMismatch(r.ID, prev, actual)
		}
		r.LateSettledAmount = &prev
		return *r, nil
	}
	bals, err := lockHolds(ctx, tx, r.ID)
	if err != nil {
		return Reservation{}, err
	}
	entries := make([]entry, 0, 2*len(bals))
	for _, b := range bals {
		b.Consumed += actual
		chargeOverrun(b.lockedBalance)
		entries = append(entries, entry{b.availAcct, -actual}, entry{b.consAcct, actual})
	}
	if err := writeBalances(ctx, tx, bals.balances()); err != nil {
		return Reservation{}, err
	}
	if err := post(ctx, tx, r.TenantID, "late_settle", &r.ID, entries); err != nil {
		return Reservation{}, err
	}
	r.LateSettledAmount = &actual
	return *r, nil
}

// ReleaseRequest gives a hold back unused (the call failed or was cancelled).
type ReleaseRequest struct {
	ReservationID int64 `json:"reservation_id"`
}

// Release moves a HELD reservation to RELEASED and returns the hold to
// available. Releasing an already released reservation returns it unchanged.
func (s *Service) Release(ctx context.Context, tenantID int64, idemKey string, req ReleaseRequest) (Reservation, error) {
	return runIdem(ctx, s, tenantID, idemKey, "release", 200, req, func(tx pgx.Tx) (Reservation, error) {
		id := req.ReservationID
		tag, err := tx.Exec(ctx, `
			UPDATE reservations SET state = 'RELEASED', updated_at = now()
			 WHERE id = $1 AND state = 'HELD'`, id)
		if err != nil {
			return Reservation{}, err
		}
		if tag.RowsAffected() == 0 {
			r, err := loadReservation(ctx, tx, id)
			if err != nil {
				return Reservation{}, err
			}
			if r.State == Released {
				return *r, nil
			}
			return Reservation{}, invalidState(id, r.State, "released")
		}
		if err := returnHolds(ctx, tx, tenantID, id, "release"); err != nil {
			return Reservation{}, err
		}
		r, err := loadReservation(ctx, tx, id)
		if err != nil {
			return Reservation{}, err
		}
		return *r, nil
	})
}

// ExtendRequest pushes a live hold's expiry forward (a heartbeat during a
// long streaming call).
type ExtendRequest struct {
	ReservationID int64 `json:"reservation_id"`
	TTLSeconds    int   `json:"ttl_seconds"`
}

// Extend sets expires_at to now + ttl, capped at the reservation's maximum
// lifetime, and never moves it backwards. A hold already past its expiry
// cannot be extended, even if the sweeper has not reached it yet.
func (s *Service) Extend(ctx context.Context, tenantID int64, idemKey string, req ExtendRequest) (Reservation, error) {
	ttl := time.Duration(req.TTLSeconds) * time.Second
	if req.TTLSeconds < 1 || ttl > MaxTTL {
		return Reservation{}, validation("ttl_seconds must be between 1 and %d", int(MaxTTL/time.Second))
	}
	return runIdem(ctx, s, tenantID, idemKey, "extend", 200, req, func(tx pgx.Tx) (Reservation, error) {
		id := req.ReservationID
		tag, err := tx.Exec(ctx, `
			UPDATE reservations
			   SET expires_at = greatest(expires_at, least(now() + $2 * interval '1 second', max_expires_at)),
			       updated_at = now()
			 WHERE id = $1 AND state = 'HELD' AND expires_at > now()`, id, ttl.Seconds())
		if err != nil {
			return Reservation{}, err
		}
		r, err := loadReservation(ctx, tx, id)
		if err != nil {
			return Reservation{}, err
		}
		if tag.RowsAffected() == 0 {
			if r.State == Held {
				return Reservation{}, &Error{Status: 409, Code: CodeExpired,
					Detail: "the hold passed its expiry and can no longer be extended"}
			}
			return Reservation{}, invalidState(id, r.State, "extended")
		}
		return *r, nil
	})
}

// GetReservation returns one reservation with its holds.
func (s *Service) GetReservation(ctx context.Context, tenantID, id int64) (Reservation, error) {
	var r *Reservation
	err := s.db.TenantTx(ctx, tenantID, func(tx pgx.Tx) error {
		var err error
		r, err = loadReservation(ctx, tx, id)
		return err
	})
	if err != nil {
		return Reservation{}, err
	}
	return *r, nil
}

// ---------------------------------------------------------------------------
// Sweeper

// SweepExpired expires up to limit HELD reservations whose expires_at has
// passed (by the database clock) and returns how many it expired. Each runs
// in its own transaction. Rows another transaction holds (a racing settle, or
// another sweeper) are skipped and picked up next sweep if still HELD.
func (s *Service) SweepExpired(ctx context.Context, limit int) (int, error) {
	var ids []int64
	err := s.db.SystemTx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `
			SELECT id FROM reservations
			 WHERE state = 'HELD' AND expires_at < now()
			 ORDER BY expires_at LIMIT $1`, limit)
		if err != nil {
			return err
		}
		ids, err = pgx.CollectRows(rows, pgx.RowTo[int64])
		return err
	})
	if err != nil {
		return 0, err
	}
	n := 0
	for _, id := range ids {
		var expired bool
		err := s.db.SystemTx(ctx, func(tx pgx.Tx) error {
			var tenantID int64
			err := tx.QueryRow(ctx, `
				SELECT tenant_id FROM reservations
				 WHERE id = $1 AND state = 'HELD' AND expires_at < now()
				   FOR UPDATE SKIP LOCKED`, id).Scan(&tenantID)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil // settled, released, extended or taken by another sweeper
			}
			if err != nil {
				return err
			}
			if _, err := tx.Exec(ctx,
				"UPDATE reservations SET state = 'EXPIRED', updated_at = now() WHERE id = $1", id); err != nil {
				return err
			}
			expired = true
			return returnHolds(ctx, tx, tenantID, id, "expire")
		})
		if err != nil {
			return n, err
		}
		if expired {
			n++
		}
	}
	return n, nil
}

// ---------------------------------------------------------------------------
// Shared helpers

// returnHolds moves a reservation's holds back to available on every node
// (release and expire). The caller has already moved the reservation out of
// HELD in this transaction, so it holds the reservation row lock.
func returnHolds(ctx context.Context, tx pgx.Tx, tenantID, id int64, kind string) error {
	bals, err := lockHolds(ctx, tx, id)
	if err != nil {
		return err
	}
	entries := make([]entry, 0, 2*len(bals))
	for _, b := range bals {
		b.Held -= b.holdAmount
		entries = append(entries, entry{b.heldAcct, -b.holdAmount}, entry{b.availAcct, b.holdAmount})
	}
	if err := writeBalances(ctx, tx, bals.balances()); err != nil {
		return err
	}
	return post(ctx, tx, tenantID, kind, &id, entries)
}

// heldBalance is a locked balance row plus the reservation's hold on it.
type heldBalance struct {
	*lockedBalance
	holdAmount int64
}

type heldBalances []heldBalance

func (h heldBalances) balances() []*lockedBalance {
	out := make([]*lockedBalance, len(h))
	for i := range h {
		out[i] = h[i].lockedBalance
	}
	return out
}

// lockHolds locks the balance rows a reservation holds on, in global order.
func lockHolds(ctx context.Context, tx pgx.Tx, id int64) (heldBalances, error) {
	rows, err := tx.Query(ctx, `
		SELECT node_id, period_start, amount FROM reservation_holds
		 WHERE reservation_id = $1 ORDER BY node_id`, id)
	if err != nil {
		return nil, err
	}
	var (
		ids     []int64
		periods []time.Time
		amounts = map[int64]int64{}
	)
	for rows.Next() {
		var (
			nid, amt int64
			ps       time.Time
		)
		if err := rows.Scan(&nid, &ps, &amt); err != nil {
			rows.Close()
			return nil, err
		}
		ids, periods, amounts[nid] = append(ids, nid), append(periods, ps), amt
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	bals, err := lockBalances(ctx, tx, ids, periods)
	if err != nil {
		return nil, err
	}
	if len(bals) != len(ids) {
		return nil, errors.New("engine: reservation holds reference missing balance rows")
	}
	out := make(heldBalances, len(bals))
	for i, b := range bals {
		out[i] = heldBalance{b, amounts[b.NodeID]}
	}
	return out, nil
}

func loadReservation(ctx context.Context, tx pgx.Tx, id int64) (*Reservation, error) {
	r := &Reservation{}
	var state string
	err := tx.QueryRow(ctx, `
		SELECT r.id, r.tenant_id, r.leaf_node_id, r.amount, r.state::text, r.expires_at, r.max_expires_at,
		       r.settled_amount, l.amount, r.created_at, r.updated_at
		  FROM reservations r LEFT JOIN late_settles l ON l.reservation_id = r.id
		 WHERE r.id = $1`, id).Scan(
		&r.ID, &r.TenantID, &r.LeafNodeID, &r.Amount, &state, &r.ExpiresAt, &r.MaxExpiresAt,
		&r.SettledAmount, &r.LateSettledAmount, &r.CreatedAt, &r.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, notFound("reservation", id)
	}
	if err != nil {
		return nil, err
	}
	r.State = State(state)
	rows, err := tx.Query(ctx, `
		SELECT node_id, period_start, amount FROM reservation_holds
		 WHERE reservation_id = $1 ORDER BY node_id`, id)
	if err != nil {
		return nil, err
	}
	r.Holds, err = pgx.CollectRows(rows, func(row pgx.CollectableRow) (Hold, error) {
		var h Hold
		err := row.Scan(&h.NodeID, &h.PeriodStart, &h.Amount)
		return h, err
	})
	if err != nil {
		return nil, err
	}
	normalizeTimes(r)
	return r, nil
}

func normalizeTimes(r *Reservation) {
	r.ExpiresAt, r.MaxExpiresAt = r.ExpiresAt.UTC(), r.MaxExpiresAt.UTC()
	r.CreatedAt, r.UpdatedAt = r.CreatedAt.UTC(), r.UpdatedAt.UTC()
	for i := range r.Holds {
		r.Holds[i].PeriodStart = r.Holds[i].PeriodStart.UTC()
	}
}

func amountMismatch(id, settled, asked int64) *Error {
	return &Error{Status: 409, Code: CodeAmountMismatch,
		Detail: fmt.Sprintf("reservation %d was settled for %d; a settled amount never changes (got %d)", id, settled, asked)}
}
