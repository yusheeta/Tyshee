# ADR 0007 (D7): Synchronous where the caller waits, events where it doesn't

Status: accepted, 2026-11-22

## Decision

Reserve, settle, release and extend are synchronous request/response. Alerts, webhooks, rollups and audits are event-driven.

## Rejected

An asynchronous 'accepted, will decide later' reserve.

## Why

A caller can't start an LLM call without a decision. Side effects tolerate seconds of delay and gain retries.

## Costs and limits

The hot path is bounded by Postgres latency (target p99 under 25 ms, to be measured in Phase 3).
