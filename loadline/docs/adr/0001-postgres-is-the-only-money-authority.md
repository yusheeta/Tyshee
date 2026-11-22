# ADR 0001 (D1): Postgres is the only authority for money

Status: accepted, 2026-11-22

## Decision

Every hold, settle and grant is a Postgres transaction.

## Rejected

Redis counters with reconciliation (after a failover or eviction credit is already spent, and reconciliation can't take it back); an event-sourced balance computed from a log (slow, complex reads); TigerBeetle (excellent, but hides the concurrency problems this project exists to own).

## Why

ACID transactions, row locks and one durable record make I1–I5 provable, and let the database enforce I1 and I2 itself.

## Costs and limits

One primary caps write throughput, and hot rows serialize. ADR D10 (budget leases) handles the hot row; sharding by tenant is the documented next step.
