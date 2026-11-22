# Test strategy

Each layer targets a class of bug the layer below it can't catch, and every
layer ends by running the auditor.

| Layer | Status | What it proves |
|-------|--------|----------------|
| Unit tests (headroom, periods, rounding) | partial | Pure logic, deterministic time |
| Engine tests against real Postgres | **done** | State machine, idempotency, overrun, isolation |
| Database guard tests | **done** | Triggers and constraints refuse corruption even from the table owner |
| Concurrency tests, race detector on | **done** | No over-admission, no deadlocks, valid end states |
| Model-based property tests (rapid) | Phase 2 | Random op sequences match a ~200-line reference model |
| Linearizability (Porcupine) | Phase 2 | Concurrent histories are linearizable, split per budget tree |
| Fault injection (failpoints, process kills, Toxiproxy) | Phase 2 | Invariants survive crashes and partitions |
| Load tests (k6) | Phase 3 | Real p50/p95/p99, hot-node ceiling |

## The eight must-have tests

| # | Test | Status |
|---|------|--------|
| 1 | 1,200 concurrent reserves admit exactly 600; zero deadlocks | `TestConcurrentReservesAdmitExactly600` ✅ |
| 2 | 30 concurrent duplicates make 1 reservation | `TestConcurrentDuplicatesCreateOneReservation` ✅ |
| 3 | 300 settles racing the sweeper all end valid | `TestSettlesRacingSweeperAllEndValid` ✅ |
| 4 | Settle above/below the hold; overrun freezes | `TestSettleBelowAndAboveHold` ✅ |
| 5 | Late settle after expiry recorded once | `TestExpiryAndLateSettle` ✅ |
| 6 | Database refuses to corrupt the ledger or reopen terminal states | `TestDatabaseGuards` ✅ |
| 7 | Tenant isolation, failing closed | `TestTenantIsolation` ✅ |
| 8 | Crash after commit, before response: retry replays | Phase 2 (failpoint) |

## Proving the tests can fail

A test that has never failed proves little. Each concurrency safeguard gets
a mutation run: remove it, confirm a test catches it, restore it, and log
the result in `bug-journal.md`.

## Running

```bash
# Postgres 16 on localhost, superuser "postgres" (or set LOADLINE_TEST_DATABASE_URL)
go test -race -count=1 ./...
```

Each test creates and drops its own database. CI sets
`LOADLINE_TEST_REQUIRE_DB=1` so a missing database fails instead of skipping.
