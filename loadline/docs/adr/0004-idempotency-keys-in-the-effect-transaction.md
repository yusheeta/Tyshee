# ADR 0004 (D4): Idempotency keys stored in the effect's transaction

Status: accepted, 2026-11-22

## Decision

A key per tenant with a request hash (endpoint + body), inserted at the start of the same transaction as the effect and completed at its end. A concurrent duplicate blocks on the primary key until the first commits, then replays its stored response; if the first rolled back, the duplicate proceeds. Same key with a different request: 422. Business outcomes (402/404/409) are stored and replayed too; the effect runs in a savepoint so a business error leaves nothing partial. Keys are kept 24 hours.

This refines the blueprint's original design (an `in_progress` state, 409 + Retry-After, takeover after `locked_until`): because every operation is one local transaction, none of that is needed.

## Rejected

Redis `SETNX` (a crash between setting the key and storing the result strands the key, and it can't commit atomically with the money change); natural keys only (works for settle, not for create); a separate in-progress state machine (unnecessary when key and effect share one transaction).

## Why

The key and the effect commit together or not at all (I4).

## Costs and limits

A duplicate waits for the first request's transaction, at most its duration. The table grows: prune by `created_at` (partition by day in Phase 3). A retry after 24 hours runs again. A stored 402 is replayed even if budget frees up; clients send a new key for a new attempt.
