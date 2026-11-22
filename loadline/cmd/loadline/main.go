// Command loadline runs Loadline's roles and operator tools.
//
//	loadline migrate              apply database migrations
//	loadline worker               run the expiry sweeper
//	loadline audit [--tenant ID]  recompute balances from the journal
//
// Configuration comes from the environment:
//
//	LOADLINE_DATABASE_URL         owner connection (migrations)
//	LOADLINE_APP_DATABASE_URL     login for loadline_app (defaults to the owner URL with SET ROLE)
//	LOADLINE_SYSTEM_DATABASE_URL  login for loadline_system (same default)
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yusheeta/tyshee/loadline/internal/audit"
	"github.com/yusheeta/tyshee/loadline/internal/db"
	"github.com/yusheeta/tyshee/loadline/internal/engine"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var err error
	switch os.Args[1] {
	case "migrate":
		err = db.Migrate(ctx, mustEnv("LOADLINE_DATABASE_URL"))
	case "worker":
		err = runWorker(ctx, os.Args[2:])
	case "audit":
		err = runAudit(ctx, os.Args[2:])
	default:
		usage()
	}
	if err != nil && ctx.Err() == nil {
		fmt.Fprintln(os.Stderr, "loadline:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: loadline migrate | worker [--interval 1s] | audit [--tenant ID]")
	os.Exit(2)
}

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		fmt.Fprintf(os.Stderr, "loadline: %s is not set\n", k)
		os.Exit(2)
	}
	return v
}

func open(ctx context.Context) (*db.DB, error) {
	owner := os.Getenv("LOADLINE_DATABASE_URL")
	app, sys := os.Getenv("LOADLINE_APP_DATABASE_URL"), os.Getenv("LOADLINE_SYSTEM_DATABASE_URL")
	setRole := app == "" || sys == ""
	if setRole {
		if owner == "" {
			mustEnv("LOADLINE_DATABASE_URL")
		}
		app, sys = owner, owner
	}
	return db.Open(ctx, app, sys, db.Options{SetRole: setRole})
}

func runWorker(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("worker", flag.ExitOnError)
	interval := fs.Duration("interval", time.Second, "time between sweeps")
	batch := fs.Int("batch", 500, "reservations expired per sweep")
	_ = fs.Parse(args)

	d, err := open(ctx)
	if err != nil {
		return err
	}
	defer d.Close()
	svc := engine.New(d)
	slog.Info("worker started", "interval", *interval)
	t := time.NewTicker(*interval)
	defer t.Stop()
	for {
		n, err := svc.SweepExpired(ctx, *batch)
		if err != nil && ctx.Err() == nil {
			slog.Error("sweep failed", "err", err)
		} else if n > 0 {
			slog.Info("expired holds", "count", n)
		}
		if n == *batch {
			continue // more are waiting
		}
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
		}
	}
}

func runAudit(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("audit", flag.ExitOnError)
	tenant := fs.Int64("tenant", 0, "audit one tenant (default: all)")
	_ = fs.Parse(args)

	d, err := open(ctx)
	if err != nil {
		return err
	}
	defer d.Close()
	var tid *int64
	if *tenant != 0 {
		tid = tenant
	}
	vs, err := audit.Run(ctx, d.System, tid)
	if err != nil {
		return err
	}
	for _, v := range vs {
		fmt.Println(v)
	}
	if len(vs) > 0 {
		return fmt.Errorf("%d violations", len(vs))
	}
	fmt.Println("audit clean: every balance matches the journal")
	return nil
}
