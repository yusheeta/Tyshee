// Package audit recomputes every balance from the journal and reports any
// disagreement. It is the proof behind invariants I1, I2 and I3, and it runs
// after every concurrency and fault-injection test, and in production as a
// scheduled job and as `loadline audit`.
package audit

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Violation is one broken invariant.
type Violation struct {
	Invariant string // I1, I2, I3
	TenantID  int64
	Detail    string
}

func (v Violation) String() string {
	return fmt.Sprintf("%s tenant=%d: %s", v.Invariant, v.TenantID, v.Detail)
}

// check is one auditor query. Every row it returns is a violation, formatted
// as (tenant_id, detail).
type check struct {
	invariant string
	sql       string
}

var checks = []check{
	{"I2", `
		SELECT t.tenant_id, format('journal transaction %s (%s) sums to %s', t.id, t.kind, sum(e.amount_micros))
		  FROM ledger_transactions t JOIN ledger_entries e ON e.transaction_id = t.id
		 WHERE $1::bigint IS NULL OR t.tenant_id = $1
		 GROUP BY t.id HAVING sum(e.amount_micros) <> 0`},
	{"I2", `
		SELECT t.tenant_id, format('journal transaction %s (%s) has no entries', t.id, t.kind)
		  FROM ledger_transactions t
		 WHERE ($1::bigint IS NULL OR t.tenant_id = $1)
		   AND NOT EXISTS (SELECT 1 FROM ledger_entries e WHERE e.transaction_id = t.id)`},
	// The balance row must equal the journal, account by account.
	{"I3", `
		WITH sums AS (
			SELECT account_id, sum(amount_micros) AS total FROM ledger_entries GROUP BY account_id
		)
		SELECT b.tenant_id,
		       format('node %s period %s: row says available=%s held=%s consumed=%s, journal says %s/%s/%s',
		              b.node_id, b.period_start, b.allocated - b.held - b.consumed, b.held, b.consumed,
		              coalesce(a.total, 0), coalesce(h.total, 0), coalesce(c.total, 0))
		  FROM node_balances b
		  LEFT JOIN sums a ON a.account_id = b.available_account_id
		  LEFT JOIN sums h ON h.account_id = b.held_account_id
		  LEFT JOIN sums c ON c.account_id = b.consumed_account_id
		 WHERE ($1::bigint IS NULL OR b.tenant_id = $1)
		   AND (coalesce(a.total, 0) <> b.allocated - b.held - b.consumed
		     OR coalesce(h.total, 0) <> b.held
		     OR coalesce(c.total, 0) <> b.consumed)`},
	// Every grant came from the tenant's external account.
	{"I3", `
		SELECT x.tenant_id, format('external account sums to %s but %s was allocated',
		                           coalesce(s.total, 0), coalesce(alloc.total, 0))
		  FROM ledger_accounts x
		  LEFT JOIN (SELECT account_id, sum(amount_micros) AS total FROM ledger_entries GROUP BY 1) s
		         ON s.account_id = x.id
		  LEFT JOIN (SELECT tenant_id, sum(allocated) AS total FROM node_balances GROUP BY 1) alloc
		         ON alloc.tenant_id = x.tenant_id
		 WHERE x.kind = 'external' AND ($1::bigint IS NULL OR x.tenant_id = $1)
		   AND coalesce(s.total, 0) <> -coalesce(alloc.total, 0)`},
	// held equals the sum of live holds.
	{"I3", `
		SELECT b.tenant_id, format('node %s period %s: held=%s but live holds sum to %s',
		                           b.node_id, b.period_start, b.held, coalesce(l.total, 0))
		  FROM node_balances b
		  LEFT JOIN (SELECT h.node_id, h.period_start, sum(h.amount) AS total
		               FROM reservation_holds h JOIN reservations r ON r.id = h.reservation_id
		              WHERE r.state = 'HELD' GROUP BY 1, 2) l
		         ON l.node_id = b.node_id AND l.period_start = b.period_start
		 WHERE ($1::bigint IS NULL OR b.tenant_id = $1) AND coalesce(l.total, 0) <> b.held`},
	// Admitted money stays inside limit + overdraft; anything past it is overrun.
	{"I1", `
		SELECT tenant_id, format('node %s period %s: held+consumed-overrun=%s exceeds allocated+overdraft=%s',
		                         node_id, period_start, held + consumed - overrun, allocated + overdraft)
		  FROM node_balances
		 WHERE ($1::bigint IS NULL OR tenant_id = $1)
		   AND held + consumed - overrun > allocated + overdraft`},
	{"I1", `
		SELECT tenant_id, format('node %s period %s has overrun %s but is not frozen', node_id, period_start, overrun)
		  FROM node_balances
		 WHERE ($1::bigint IS NULL OR tenant_id = $1) AND overrun > 0 AND NOT frozen`},
	// Each terminal reservation has exactly the journal it should.
	{"I3", `
		SELECT r.tenant_id, format('reservation %s is %s but has %s release/settle/expire journal transactions',
		                           r.id, r.state, count(t.id))
		  FROM reservations r
		  LEFT JOIN ledger_transactions t
		         ON t.reservation_id = r.id AND t.kind IN ('settle', 'release', 'expire')
		 WHERE ($1::bigint IS NULL OR r.tenant_id = $1)
		 GROUP BY r.id
		HAVING count(t.id) <> CASE WHEN r.state = 'HELD' THEN 0 ELSE 1 END`},
}

// Run audits one tenant, or every tenant when tenantID is nil. It must use a
// connection that can read across tenants (the system role).
func Run(ctx context.Context, pool *pgxpool.Pool, tenantID *int64) ([]Violation, error) {
	var out []Violation
	err := pgx.BeginTxFunc(ctx, pool, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly},
		func(tx pgx.Tx) error {
			// One snapshot for every check, so concurrent writes can't make
			// two consistent tables look inconsistent.
			for _, c := range checks {
				rows, err := tx.Query(ctx, c.sql, tenantID)
				if err != nil {
					return fmt.Errorf("audit %s: %w", c.invariant, err)
				}
				for rows.Next() {
					v := Violation{Invariant: c.invariant}
					if err := rows.Scan(&v.TenantID, &v.Detail); err != nil {
						rows.Close()
						return err
					}
					out = append(out, v)
				}
				rows.Close()
				if err := rows.Err(); err != nil {
					return err
				}
			}
			return nil
		})
	return out, err
}
