// Package testdb gives each test its own freshly migrated database.
package testdb

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/yusheeta/tyshee/loadline/internal/db"
)

// AdminURL is the superuser connection tests use to create databases.
// Override with LOADLINE_TEST_DATABASE_URL.
func AdminURL() string {
	if u := os.Getenv("LOADLINE_TEST_DATABASE_URL"); u != "" {
		return u
	}
	return "postgres://postgres@127.0.0.1:5432/postgres?sslmode=disable"
}

// DB is a migrated test database.
type DB struct {
	*db.DB
	// URL connects to this database as the superuser.
	URL string
}

// New creates, migrates and opens a new database, and drops it when the
// test ends. It skips the test if Postgres is unreachable, unless
// LOADLINE_TEST_REQUIRE_DB is set (as it is in CI).
func New(t testing.TB) *DB {
	t.Helper()
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, AdminURL())
	if err != nil {
		if os.Getenv("LOADLINE_TEST_REQUIRE_DB") != "" {
			t.Fatalf("postgres unreachable: %v", err)
		}
		t.Skipf("postgres unreachable (set LOADLINE_TEST_DATABASE_URL): %v", err)
	}
	defer admin.Close(ctx)

	b := make([]byte, 6)
	_, _ = rand.Read(b)
	name := "loadline_test_" + hex.EncodeToString(b)
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	u, err := url.Parse(AdminURL())
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + name
	dbURL := u.String()

	if err := db.Migrate(ctx, dbURL); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	d, err := db.Open(ctx, dbURL, dbURL, db.Options{MaxConns: 40, SetRole: true})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() {
		d.Close()
		c, err := pgx.Connect(context.Background(), AdminURL())
		if err != nil {
			return
		}
		defer c.Close(context.Background())
		_, _ = c.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
	})
	return &DB{DB: d, URL: dbURL}
}

// Deadlocks returns Postgres's deadlock counter for this database.
func (d *DB) Deadlocks(t testing.TB) int64 {
	t.Helper()
	var n int64
	err := d.System.QueryRow(context.Background(),
		"SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()").Scan(&n)
	if err != nil {
		t.Fatal(err)
	}
	return n
}
