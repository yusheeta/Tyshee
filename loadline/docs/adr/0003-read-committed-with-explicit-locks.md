# ADR 0003 (D3): READ COMMITTED plus explicit locks, not SERIALIZABLE

Status: accepted, 2026-11-22

## Decision

Postgres's default READ COMMITTED, with explicit row locks on every money path.

## Rejected

SERIALIZABLE everywhere (correct by default, but under contention it aborts many transactions and retries pile up); REPEATABLE READ (same failure on concurrent updates).

## Why

Predictable behavior under load, and each lock maps to the anomaly it prevents (lost update, write skew). The auditor alone uses REPEATABLE READ, read-only, for one consistent snapshot.

## Costs and limits

Correctness depends on discipline: every money path goes through the engine's lock helpers, and the concurrency tests guard them.
