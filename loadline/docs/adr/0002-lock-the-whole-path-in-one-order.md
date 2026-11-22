# ADR 0002 (D2): Lock the whole path, in one global order

Status: accepted, 2026-11-22

## Decision

`SELECT … FOR UPDATE` on every node of the path, ordered by `node_id`, then check and update in the same transaction. Global order: idempotency key, reservation, late settle, balances ascending.

## Rejected

Read-then-write without locks (lost updates); optimistic version checks (retry storms on the hot root row); advisory locks (easy to leak, invisible to the schema).

## Why

Pessimistic locks suit hot, contended rows; one total order rules out deadlock cycles. A mutation run without the lock logged 553 deadlocks (bug journal).

## Costs and limits

Every reservation under one org queues on the org's row. Transactions must stay short, with no network calls inside.
