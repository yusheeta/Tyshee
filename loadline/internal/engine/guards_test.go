package engine_test

import (
	"context"
	"strconv"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/yusheeta/tyshee/loadline/internal/engine"
)

// The database refuses to corrupt money even if Go code tries to. Each case
// runs as the system role, which bypasses row-level security but not
// triggers or CHECK constraints.
func TestDatabaseGuards(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	org := f.node(nil, "acme", 10*dollar, 0)
	r := f.reserve(org, dollar, 0)
	if _, err := f.svc.Release(ctx, f.tenant, f.key(), engine.ReleaseRequest{ReservationID: r.ID}); err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name string
		sql  []string
	}{
		{"journal entries are append-only (update)", []string{"UPDATE ledger_entries SET amount_micros = amount_micros * 2"}},
		{"journal entries are append-only (delete)", []string{"DELETE FROM ledger_entries"}},
		{"journal cannot be truncated", []string{"TRUNCATE ledger_entries CASCADE"}},
		{"terminal reservations are final", []string{"UPDATE reservations SET state = 'HELD'"}},
		{"reservations are never deleted", []string{"DELETE FROM reservations"}},
		{"balance cannot pass limit + overdraft (I1)", []string{"UPDATE node_balances SET held = allocated + 1"}},
		{"overrun requires a frozen node", []string{"UPDATE node_balances SET consumed = 1, overrun = 1"}},
		{"unbalanced journal transaction fails at commit (I2)", []string{
			"INSERT INTO ledger_transactions (tenant_id, kind) VALUES (" + strconv.FormatInt(f.tenant, 10) + ", 'grant')",
			"INSERT INTO ledger_entries (transaction_id, tenant_id, account_id, amount_micros) " +
				"SELECT currval('ledger_transactions_id_seq'), tenant_id, id, 5 FROM ledger_accounts WHERE kind = 'external'",
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			// System role first (no RLS), then the owner, which has every grant:
			// the triggers and constraints must stop both.
			for _, pool := range []string{"system", "owner"} {
				conn, err := pgx.Connect(ctx, f.db.URL)
				if err != nil {
					t.Fatal(err)
				}
				if pool == "system" {
					if _, err := conn.Exec(ctx, "SET ROLE loadline_system"); err != nil {
						t.Fatal(err)
					}
				}
				err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
					for _, q := range c.sql {
						if _, err := tx.Exec(ctx, q); err != nil {
							return err
						}
					}
					return nil
				})
				conn.Close(ctx)
				if err == nil {
					t.Errorf("%s: the database allowed it", pool)
				}
			}
		})
	}
	f.mustAudit()
}
