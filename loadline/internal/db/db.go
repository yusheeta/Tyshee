// Package db owns Postgres access: migrations, the two role-scoped pools,
// and the transaction helpers every money path goes through.
package db

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yusheeta/tyshee/loadline/migrations"
)

// DB holds one pool per database role.
//
// App runs as loadline_app and is confined to one tenant per transaction by
// row-level security. System runs as loadline_system and may cross tenants;
// only the worker and admin tooling use it.
type DB struct {
	App    *pgxpool.Pool
	System *pgxpool.Pool
}

// Options configures Open.
type Options struct {
	// MaxConns per pool. Zero means the pgxpool default.
	MaxConns int32
	// SetRole switches each connection to the role with SET ROLE. Use it when
	// the login user is a member of both roles (local development, tests).
	// Production logs in as dedicated users and leaves this false.
	SetRole bool
}

// Open connects both pools. appURL and systemURL may be the same when
// opts.SetRole is true.
func Open(ctx context.Context, appURL, systemURL string, opts Options) (*DB, error) {
	app, err := newPool(ctx, appURL, "loadline_app", opts)
	if err != nil {
		return nil, fmt.Errorf("app pool: %w", err)
	}
	sys, err := newPool(ctx, systemURL, "loadline_system", opts)
	if err != nil {
		app.Close()
		return nil, fmt.Errorf("system pool: %w", err)
	}
	return &DB{App: app, System: sys}, nil
}

func newPool(ctx context.Context, url, role string, opts Options) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	if opts.MaxConns > 0 {
		cfg.MaxConns = opts.MaxConns
	}
	if opts.SetRole {
		cfg.AfterConnect = func(ctx context.Context, c *pgx.Conn) error {
			_, err := c.Exec(ctx, "SET ROLE "+pgx.Identifier{role}.Sanitize())
			return err
		}
	}
	return pgxpool.NewWithConfig(ctx, cfg)
}

// Close closes both pools.
func (d *DB) Close() {
	d.App.Close()
	d.System.Close()
}

// TenantTx runs fn in a READ COMMITTED transaction on the app pool with
// app.tenant_id set, so row-level security confines every statement to one
// tenant. It commits if fn returns nil and rolls back otherwise.
func (d *DB) TenantTx(ctx context.Context, tenantID int64, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, d.App, pgx.TxOptions{IsoLevel: pgx.ReadCommitted}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "SELECT set_config('app.tenant_id', $1, true)",
			strconv.FormatInt(tenantID, 10)); err != nil {
			return err
		}
		return fn(tx)
	})
}

// SystemTx runs fn in a READ COMMITTED transaction on the system pool.
func (d *DB) SystemTx(ctx context.Context, fn func(pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, d.System, pgx.TxOptions{IsoLevel: pgx.ReadCommitted}, fn)
}

// IsCode reports whether err is a Postgres error with the given SQLSTATE.
func IsCode(err error, code string) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == code
}

// Migrate applies pending migrations with an owner (superuser or schema
// owner) connection. It takes an advisory lock so concurrent callers apply
// each file once.
func Migrate(ctx context.Context, url string) error {
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)

	const lockKey = 7_413_001 // arbitrary, fixed: "loadline migrations"
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", lockKey); err != nil {
		return err
	}
	defer conn.Exec(ctx, "SELECT pg_advisory_unlock($1)", lockKey) //nolint:errcheck

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	names, err := fs.Glob(migrations.FS, "*.sql")
	if err != nil {
		return err
	}
	sort.Strings(names)
	for _, name := range names {
		var done bool
		if err := conn.QueryRow(ctx,
			"SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1)", name).Scan(&done); err != nil {
			return err
		}
		if done {
			continue
		}
		body, err := fs.ReadFile(migrations.FS, name)
		if err != nil {
			return err
		}
		err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, string(body)); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, "INSERT INTO schema_migrations (name) VALUES ($1)", name)
			return err
		})
		if err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}
