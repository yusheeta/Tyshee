# ADR 0006 (D6): Events through a transactional outbox, not Kafka

Status: accepted, 2026-11-22

## Decision

Side effects (webhooks, threshold alerts) are written as outbox rows in the same transaction as the state change, then relayed by workers (Phase 2).

## Rejected

Publishing to Kafka or Redpanda from the handler (a dual write: commit and publish can disagree); calling webhooks inline (slow, fragile); NATS (another system to run).

## Why

An event exists if and only if its change committed (I8), with nothing extra to operate.

## Costs and limits

Postgres as a queue tops out in the thousands of events per second and needs vacuum tuning. Move to Kafka on sustained throughput beyond that, several independent consumers, or a need for long replay.
