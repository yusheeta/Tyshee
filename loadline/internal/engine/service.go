package engine

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/yusheeta/tyshee/loadline/internal/db"
)

// Service is the money engine. It is safe for concurrent use.
type Service struct {
	db *db.DB
}

// New returns a Service backed by d.
func New(d *db.DB) *Service { return &Service{db: d} }

// ---------------------------------------------------------------------------
// Tenants and budget nodes

// CreateTenant creates a tenant and its external (grant source) account.
// It is an admin operation and runs on the system role.
func (s *Service) CreateTenant(ctx context.Context, name string) (int64, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 0, validation("tenant name is required")
	}
	var id int64
	err := s.db.SystemTx(ctx, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, "INSERT INTO tenants (name) VALUES ($1) RETURNING id", name).Scan(&id); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, "INSERT INTO ledger_accounts (tenant_id, kind) VALUES ($1, 'external')", id)
		return err
	})
	return id, err
}

// NodeSpec describes a budget node to create.
type NodeSpec struct {
	ParentID        *int64 `json:"parent_id,omitempty"`
	Name            string `json:"name"`
	Period          Period `json:"period"`
	LimitMicros     int64  `json:"limit_micros"`
	OverdraftMicros int64  `json:"overdraft_micros"`
}

// CreateNode adds a node to the tenant's budget tree.
func (s *Service) CreateNode(ctx context.Context, tenantID int64, spec NodeSpec) (Node, error) {
	spec.Name = strings.TrimSpace(spec.Name)
	switch {
	case spec.Name == "":
		return Node{}, validation("name is required")
	case !spec.Period.Valid():
		return Node{}, validation("period must be daily, monthly or none")
	case spec.LimitMicros < 0 || spec.OverdraftMicros < 0:
		return Node{}, validation("limit_micros and overdraft_micros must be non-negative")
	}
	var n Node
	err := s.db.TenantTx(ctx, tenantID, func(tx pgx.Tx) error {
		var ancestors []int64
		if spec.ParentID != nil {
			err := tx.QueryRow(ctx, "SELECT ancestor_ids FROM budget_nodes WHERE id = $1", *spec.ParentID).Scan(&ancestors)
			if errors.Is(err, pgx.ErrNoRows) {
				return notFound("parent node", *spec.ParentID)
			} else if err != nil {
				return err
			}
			if len(ancestors) >= MaxDepth {
				return validation("budget trees are at most %d levels deep", MaxDepth)
			}
		}
		var id int64
		if err := tx.QueryRow(ctx, "SELECT nextval('budget_nodes_id_seq')").Scan(&id); err != nil {
			return err
		}
		path := append(append([]int64{}, ancestors...), id)
		err := tx.QueryRow(ctx, `
			INSERT INTO budget_nodes (id, tenant_id, parent_id, name, ancestor_ids, depth, period,
			                          limit_micros, overdraft_micros)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING created_at`,
			id, tenantID, spec.ParentID, spec.Name, path, len(path), string(spec.Period),
			spec.LimitMicros, spec.OverdraftMicros).Scan(&n.CreatedAt)
		if db.IsCode(err, "23505") {
			return &Error{Status: 409, Code: "node_name_taken",
				Detail: fmt.Sprintf("a sibling node is already named %q", spec.Name)}
		}
		if err != nil {
			return err
		}
		n = Node{ID: id, TenantID: tenantID, ParentID: spec.ParentID, Name: spec.Name, Depth: len(path),
			AncestorIDs: path, Period: spec.Period, LimitMicros: spec.LimitMicros,
			OverdraftMicros: spec.OverdraftMicros, CreatedAt: n.CreatedAt}
		return nil
	})
	return n, err
}

// GetNode returns one node.
func (s *Service) GetNode(ctx context.Context, tenantID, nodeID int64) (Node, error) {
	var n Node
	err := s.db.TenantTx(ctx, tenantID, func(tx pgx.Tx) error {
		var period string
		err := tx.QueryRow(ctx, `
			SELECT id, tenant_id, parent_id, name, depth, ancestor_ids, period::text,
			       limit_micros, overdraft_micros, created_at
			  FROM budget_nodes WHERE id = $1`, nodeID).Scan(
			&n.ID, &n.TenantID, &n.ParentID, &n.Name, &n.Depth, &n.AncestorIDs, &period,
			&n.LimitMicros, &n.OverdraftMicros, &n.CreatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return notFound("budget node", nodeID)
		}
		n.Period = Period(period)
		return err
	})
	return n, err
}

// Balances returns the current-period balance of a node and each of its
// ancestors, root first. Periods that have not been opened yet are reported
// as untouched (full allocation available).
func (s *Service) Balances(ctx context.Context, tenantID, nodeID int64) ([]Balance, error) {
	var out []Balance
	err := s.db.TenantTx(ctx, tenantID, func(tx pgx.Tx) error {
		path, now, err := nodePath(ctx, tx, nodeID)
		if err != nil {
			return err
		}
		rows, err := tx.Query(ctx, `
			SELECT n.id, n.period::text, n.limit_micros, n.overdraft_micros,
			       b.period_start, b.allocated, b.overdraft, b.held, b.consumed, b.overrun, b.frozen
			  FROM budget_nodes n
			  LEFT JOIN node_balances b
			    ON b.node_id = n.id
			   AND b.period_start = CASE n.period
			         WHEN 'daily'   THEN date_trunc('day', $2::timestamptz, 'UTC')
			         WHEN 'monthly' THEN date_trunc('month', $2::timestamptz, 'UTC')
			         ELSE 'epoch'::timestamptz END
			 WHERE n.id = ANY($1)
			 ORDER BY n.depth`, path, now)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var (
				b                     Balance
				period                string
				limit, overdraft      int64
				ps                    *time.Time
				alloc, od, h, c, over *int64
				frozen                *bool
			)
			if err := rows.Scan(&b.NodeID, &period, &limit, &overdraft, &ps, &alloc, &od, &h, &c, &over, &frozen); err != nil {
				return err
			}
			if ps == nil { // period not opened yet
				b.PeriodStart = Period(period).Start(now)
				b.Allocated, b.Overdraft = limit, overdraft
			} else {
				b.PeriodStart, b.Allocated, b.Overdraft = ps.UTC(), *alloc, *od
				b.Held, b.Consumed, b.Overrun, b.Frozen = *h, *c, *over, *frozen
			}
			out = append(out, b)
		}
		return rows.Err()
	})
	return out, err
}

// nodePath returns the root-to-leaf path of a node and the database clock.
func nodePath(ctx context.Context, tx pgx.Tx, nodeID int64) ([]int64, time.Time, error) {
	var (
		path []int64
		now  time.Time
	)
	err := tx.QueryRow(ctx, "SELECT ancestor_ids, now() FROM budget_nodes WHERE id = $1", nodeID).Scan(&path, &now)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, now, notFound("budget node", nodeID)
	}
	return path, now, err
}

// pathPeriods returns, for each node on the path in ascending node_id order,
// the start of the period containing now.
func pathPeriods(ctx context.Context, tx pgx.Tx, path []int64, now time.Time) ([]int64, []time.Time, error) {
	rows, err := tx.Query(ctx, "SELECT id, period::text FROM budget_nodes WHERE id = ANY($1) ORDER BY id", path)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var (
		ids     []int64
		periods []time.Time
	)
	for rows.Next() {
		var (
			id int64
			p  string
		)
		if err := rows.Scan(&id, &p); err != nil {
			return nil, nil, err
		}
		ids = append(ids, id)
		periods = append(periods, Period(p).Start(now))
	}
	return ids, periods, rows.Err()
}

// ---------------------------------------------------------------------------
// Periods

// openPeriods creates the current-period balance rows (and their ledger
// accounts and grant) for every node on a leaf's path. It runs in its own
// short transaction, outside any reserve, and is safe to run concurrently:
// inserts are ON CONFLICT DO NOTHING in ascending node_id order, and only
// the transaction that inserts a balance row posts its grant.
func (s *Service) openPeriods(ctx context.Context, tenantID, leafID int64) error {
	return s.db.TenantTx(ctx, tenantID, func(tx pgx.Tx) error {
		path, now, err := nodePath(ctx, tx, leafID)
		if err != nil {
			return err
		}
		var external int64
		if err := tx.QueryRow(ctx,
			"SELECT id FROM ledger_accounts WHERE tenant_id = $1 AND kind = 'external'", tenantID).Scan(&external); err != nil {
			return fmt.Errorf("external account: %w", err)
		}
		rows, err := tx.Query(ctx, `
			SELECT id, period::text, limit_micros, overdraft_micros
			  FROM budget_nodes WHERE id = ANY($1) ORDER BY id`, path)
		if err != nil {
			return err
		}
		type nodeRow struct {
			id, limit, overdraft int64
			period               Period
		}
		var nodes []nodeRow
		for rows.Next() {
			var (
				n nodeRow
				p string
			)
			if err := rows.Scan(&n.id, &p, &n.limit, &n.overdraft); err != nil {
				rows.Close()
				return err
			}
			n.period = Period(p)
			nodes = append(nodes, n)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}

		for _, n := range nodes {
			ps := n.period.Start(now)
			if _, err := tx.Exec(ctx, `
				INSERT INTO ledger_accounts (tenant_id, node_id, period_start, kind)
				VALUES ($1, $2, $3, 'available'), ($1, $2, $3, 'held'), ($1, $2, $3, 'consumed')
				ON CONFLICT DO NOTHING`, tenantID, n.id, ps); err != nil {
				return err
			}
			var avail, held, consumed int64
			if err := tx.QueryRow(ctx, `
				SELECT max(id) FILTER (WHERE kind = 'available'),
				       max(id) FILTER (WHERE kind = 'held'),
				       max(id) FILTER (WHERE kind = 'consumed')
				  FROM ledger_accounts WHERE node_id = $1 AND period_start = $2`, n.id, ps).Scan(&avail, &held, &consumed); err != nil {
				return err
			}
			tag, err := tx.Exec(ctx, `
				INSERT INTO node_balances (tenant_id, node_id, period_start, allocated, overdraft,
				                           available_account_id, held_account_id, consumed_account_id)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				ON CONFLICT DO NOTHING`, tenantID, n.id, ps, n.limit, n.overdraft, avail, held, consumed)
			if err != nil {
				return err
			}
			if tag.RowsAffected() == 1 {
				if err := post(ctx, tx, tenantID, "grant", nil, []entry{
					{external, -n.limit}, {avail, n.limit},
				}); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// ---------------------------------------------------------------------------
// Locked balances

// lockedBalance is a node_balances row locked FOR UPDATE, with its accounts.
type lockedBalance struct {
	Balance
	tenantID                      int64
	availAcct, heldAcct, consAcct int64
}

// lockBalances locks the given (node, period) rows in ascending node_id
// order: the global lock order that rules out deadlocks. ids must already be
// sorted ascending. Missing rows are simply absent from the result.
func lockBalances(ctx context.Context, tx pgx.Tx, ids []int64, periods []time.Time) ([]*lockedBalance, error) {
	rows, err := tx.Query(ctx, `
		SELECT b.tenant_id, b.node_id, b.period_start, b.allocated, b.overdraft, b.held, b.consumed,
		       b.overrun, b.frozen, b.available_account_id, b.held_account_id, b.consumed_account_id
		  FROM node_balances b
		  JOIN unnest($1::bigint[], $2::timestamptz[]) AS p(node_id, period_start)
		    ON b.node_id = p.node_id AND b.period_start = p.period_start
		 ORDER BY b.node_id
		   FOR UPDATE OF b`, ids, periods)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*lockedBalance
	for rows.Next() {
		b := &lockedBalance{}
		if err := rows.Scan(&b.tenantID, &b.NodeID, &b.PeriodStart, &b.Allocated, &b.Overdraft, &b.Held,
			&b.Consumed, &b.Overrun, &b.Frozen, &b.availAcct, &b.heldAcct, &b.consAcct); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// writeBalances stores the new values of locked rows.
func writeBalances(ctx context.Context, tx pgx.Tx, bs []*lockedBalance) error {
	n := len(bs)
	ids, periods := make([]int64, n), make([]time.Time, n)
	held, consumed, overrun, frozen := make([]int64, n), make([]int64, n), make([]int64, n), make([]bool, n)
	for i, b := range bs {
		ids[i], periods[i] = b.NodeID, b.PeriodStart
		held[i], consumed[i], overrun[i], frozen[i] = b.Held, b.Consumed, b.Overrun, b.Frozen
	}
	tag, err := tx.Exec(ctx, `
		UPDATE node_balances b
		   SET held = v.held, consumed = v.consumed, overrun = v.overrun, frozen = v.frozen,
		       version = b.version + 1, updated_at = now()
		  FROM unnest($1::bigint[], $2::timestamptz[], $3::bigint[], $4::bigint[], $5::bigint[], $6::bool[])
		       AS v(node_id, period_start, held, consumed, overrun, frozen)
		 WHERE b.node_id = v.node_id AND b.period_start = v.period_start`,
		ids, periods, held, consumed, overrun, frozen)
	if err != nil {
		return err
	}
	if int(tag.RowsAffected()) != n {
		return fmt.Errorf("engine: updated %d balance rows, want %d", tag.RowsAffected(), n)
	}
	return nil
}

// chargeOverrun records any usage past allocated + overdraft as overrun and
// freezes the node (I1: overrun is recorded separately, never admitted).
func chargeOverrun(b *lockedBalance) {
	excess := b.Held + b.Consumed - b.Overrun - (b.Allocated + b.Overdraft)
	if excess > 0 {
		b.Overrun += excess
		b.Frozen = true
	}
}

// ---------------------------------------------------------------------------
// Idempotency (I4)

// runIdem runs fn exactly once per (tenant, key) inside one transaction.
//
// The key row is inserted first. A concurrent duplicate blocks on the
// primary key until the first transaction ends, then sees its committed row
// and replays the stored response, so there is no in-progress state to
// manage. The same key with a different endpoint or body is rejected with
// 422. Business outcomes (*Error) are stored and replayed too; fn runs in a
// savepoint so a business error leaves no partial writes. Any other error
// rolls back everything, key included, so the retry runs fresh.
func runIdem[T any](ctx context.Context, s *Service, tenantID int64, key, endpoint string, okStatus int,
	req any, fn func(pgx.Tx) (T, error)) (T, error) {

	var zero T
	if key == "" || len(key) > 255 {
		return zero, validation("an Idempotency-Key of 1 to 255 characters is required")
	}
	body, err := json.Marshal(req)
	if err != nil {
		return zero, err
	}
	h := sha256.Sum256(append([]byte(endpoint+"\n"), body...))

	var (
		out    T
		bizErr *Error
	)
	err = s.db.TenantTx(ctx, tenantID, func(tx pgx.Tx) error {
		out, bizErr = zero, nil
		tag, err := tx.Exec(ctx, `
			INSERT INTO idempotency_keys (tenant_id, key, endpoint, request_hash)
			VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, tenantID, key, endpoint, h[:])
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			var (
				storedEndpoint string
				storedHash     []byte
				code           int
				resp           []byte
			)
			if err := tx.QueryRow(ctx, `
				SELECT endpoint, request_hash, response_code, response_body
				  FROM idempotency_keys WHERE tenant_id = $1 AND key = $2`, tenantID, key).Scan(
				&storedEndpoint, &storedHash, &code, &resp); err != nil {
				return fmt.Errorf("idempotency replay: %w", err)
			}
			if storedEndpoint != endpoint || string(storedHash) != string(h[:]) {
				bizErr = &Error{Status: 422, Code: CodeIdempotencyMismatch,
					Detail: "this Idempotency-Key was already used with a different request"}
				return nil
			}
			if code >= 300 {
				bizErr = &Error{}
				return json.Unmarshal(resp, bizErr)
			}
			return json.Unmarshal(resp, &out)
		}

		sp, err := tx.Begin(ctx)
		if err != nil {
			return err
		}
		res, ferr := fn(sp)
		var (
			code int
			resp any
		)
		if ferr != nil {
			e, ok := AsError(ferr)
			if !ok {
				return ferr
			}
			if err := sp.Rollback(ctx); err != nil {
				return err
			}
			bizErr, code, resp = e, e.Status, e
		} else {
			if err := sp.Commit(ctx); err != nil {
				return err
			}
			out, code, resp = res, okStatus, res
		}
		stored, err := json.Marshal(resp)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `
			UPDATE idempotency_keys SET response_code = $3, response_body = $4
			 WHERE tenant_id = $1 AND key = $2`, tenantID, key, code, stored)
		return err
	})
	if err != nil {
		return zero, err
	}
	if bizErr != nil {
		return zero, bizErr
	}
	return out, nil
}
