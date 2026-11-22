# Loadline

**Real-time spend control for AI agents.** Before an agent makes an
expensive call, it reserves budget. After the call, it settles the actual
cost. Loadline guarantees that no agent, project or team can ever spend past
its budget, even with hundreds of concurrent requests and crashes along the way.

```text
Agent ──reserve($0.40)──▶ Loadline ──▶ granted (hold)  or  402 budget_exceeded
  │
  ├── calls the LLM (in your system)
  │
  └──settle($0.31)──▶ Loadline: release the hold, charge the actual cost, write the ledger
       (or release, if the call failed; or the hold expires and the sweeper cleans it up)
```

A reserve holds the amount on **every level** of a budget tree at once, or on none:

```text
Acme (org)                $1,000 / month
├── Project: Support bot  $300 / month
│   ├── Agent: triage      $50 / day
│   └── Agent: drafter     $80 / day
└── Project: Search       $500 / month
```

> Status: **Phase 1, slices 1–5 of 7.** The money engine, ledger, sweeper
> and auditor are built and tested; the HTTP API is next. See
> [`docs/roadmap.md`](docs/roadmap.md).

## What's proven so far

All run against real Postgres 16 with Go's race detector on.

| Test | Result |
|------|--------|
| 1,200 concurrent reserves against a tree that fits 600 | exactly 600 granted, 0 deadlocks, ledger audit clean |
| 30 concurrent duplicates with one Idempotency-Key | 1 reservation; all 30 callers get the same one |
| 300 settles racing 4 sweepers on expired holds | every reservation ends SETTLED, or EXPIRED with its late settle recorded once |
| Direct SQL tampering as the table owner | the database refuses: append-only journal, sums-to-zero at commit, final terminal states, limit CHECK |
| Tenant B touching tenant A's data | not found; with no tenant set, the API role reads nothing at all |

And the tests can fail: with the balance row lock removed, the first test
logs 553 deadlocks and never finishes ([bug journal](docs/bug-journal.md)).

## How it stays correct

- **Postgres is the only authority for money.** Every reserve, settle,
  release and expiry is one short `READ COMMITTED` transaction.
- **One global lock order**: idempotency key → reservation → balances in
  ascending `node_id`. No cycles, so no deadlocks.
- **Every transition is `UPDATE … WHERE state = 'HELD'`**: when a settle
  races the sweeper, exactly one wins; a losing settle becomes a recorded
  late settle and the reservation stays EXPIRED.
- **Idempotency keys commit with the effect**: a duplicate in flight blocks
  on the key's primary key, then replays the stored response.
- **A double-entry, append-only ledger** whose transactions must sum to
  zero at commit, and an auditor that recomputes every balance from it.
- **The database enforces what it can**: I1 as a CHECK constraint, I2 as a
  deferred trigger, I5 as a state guard, I9 as row-level security.

Details: [invariants](docs/invariants.md) · [transactions](docs/transactions.md) ·
[schema](docs/schema.md) · [ADRs](docs/adr/) · [test strategy](docs/test-strategy.md).

## Layout

```text
cmd/loadline/        CLI: migrate, worker (sweeper), audit
internal/engine/     budget tree, reserve/settle/release/extend, idempotency, sweeper
internal/audit/      recomputes balances from the journal (I1–I3)
internal/db/         pools per role, transaction helpers, migrator
migrations/          the schema, with its constraints, triggers and RLS
docs/                Phase 0 design package, ADRs, bug journal
```

## Run it

```bash
docker compose up        # Postgres, migrations, the sweeper
```

Tests need a Postgres 16 superuser on `127.0.0.1:5432` (or set
`LOADLINE_TEST_DATABASE_URL`); each test creates and drops its own database:

```bash
go test -race -count=1 ./...
```

Audit a database at any time:

```bash
LOADLINE_DATABASE_URL=postgres://... go run ./cmd/loadline audit
```
