package engine

import (
	"context"

	"github.com/jackc/pgx/v5"
)

// entry is one line of a journal transaction. Amounts are signed; the
// entries of one transaction must sum to zero, which the database checks at
// commit (I2). Zero amounts are dropped.
type entry struct {
	account int64
	amount  int64
}

// post writes one balanced journal transaction.
func post(ctx context.Context, tx pgx.Tx, tenantID int64, kind string, reservationID *int64, entries []entry) error {
	accounts := make([]int64, 0, len(entries))
	amounts := make([]int64, 0, len(entries))
	for _, e := range entries {
		if e.amount != 0 {
			accounts = append(accounts, e.account)
			amounts = append(amounts, e.amount)
		}
	}
	if len(accounts) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `
		WITH t AS (
			INSERT INTO ledger_transactions (tenant_id, kind, reservation_id)
			VALUES ($1, $2, $3) RETURNING id
		)
		INSERT INTO ledger_entries (transaction_id, tenant_id, account_id, amount_micros)
		SELECT t.id, $1, e.account_id, e.amount
		  FROM t, unnest($4::bigint[], $5::bigint[]) AS e(account_id, amount)`,
		tenantID, kind, reservationID, accounts, amounts)
	return err
}
