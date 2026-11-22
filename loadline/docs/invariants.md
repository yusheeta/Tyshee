# Correctness invariants

These nine invariants define "correct" for Loadline. Every design decision
exists to keep them, and every test ends by checking them. Where an
invariant is enforced by the database itself, a bug in Go code fails a
transaction instead of corrupting money.

| ID | Invariant | Enforced by | Checked by |
|----|-----------|-------------|------------|
| I1 | **No over-admission.** No hold is granted that would push any node's `held + consumed` past `limit + overdraft`. Usage reported past that (a settle above the hold, a late settle) is recorded as `overrun` and freezes the node. | Path locks in ascending `node_id` (T1); `CHECK (held + consumed - overrun <= allocated + overdraft)`; `CHECK (frozen OR overrun = 0)` | `TestConcurrentReservesAdmitExactly600`, `TestSettleBelowAndAboveHold`, auditor |
| I2 | **Balanced ledger.** Every journal transaction's entries sum to zero; history is append-only. | Deferred constraint trigger `ledger_entries_balanced`; append-only triggers; no UPDATE grant | `TestDatabaseGuards`, auditor |
| I3 | **Conservation.** Per node and period: `available + held + consumed = allocated`, each balance column equals its journal account, and `held` equals the sum of live holds. | Balances and entries written in one transaction | Auditor (`loadline audit`) after every test |
| I4 | **One effect per idempotency key.** A repeat returns the original result; the same key with a different request is rejected (422). | Key row inserted in the same transaction as the effect; primary key on `(tenant_id, key)` | `TestConcurrentDuplicatesCreateOneReservation`, `TestIdempotencyReplaysAndRejectsReuse` |
| I5 | **Terminal states are final.** A reservation ends in exactly one of SETTLED, RELEASED, EXPIRED and never leaves it. | Every transition is `UPDATE … WHERE state = 'HELD'`; trigger `reservations_state_guard` | `TestSettlesRacingSweeperAllEndValid`, `TestDatabaseGuards` |
| I6 | **No stranded holds.** Every hold is settled, released or expired within its TTL plus one sweep interval. | Sweeper (`SweepExpired`) using the database clock | `TestExpiryAndLateSettle`; sweeper-lag metric (Phase 1 slice 7) |
| I7 | **Each usage event counts once.** A `(tenant, event_id)` pair affects balances at most once. | Primary key on `usage_events` | Redelivery tests (with the usage endpoint) |
| I8 | **Webhooks match committed state.** A webhook is sent only if its change committed, and retries carry the same `webhook-id`. | Transactional outbox (Phase 2) | Outbox and crash tests (Phase 2) |
| I9 | **Tenant isolation.** No key or user can read or change another tenant's data. | Row-level security on every tenant table, keyed on `app.tenant_id`; fails closed when unset | `TestTenantIsolation` |
