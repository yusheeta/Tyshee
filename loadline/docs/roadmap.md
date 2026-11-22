# Roadmap

| Phase | What | Milestone | Status |
|-------|------|-----------|--------|
| 0 Design | Requirements, invariants, transaction design, schema, ADRs, test strategy | Explain every invariant and lock | ✅ docs in this folder |
| 1 Core MVP | 7 slices (below) | Start applying | slices 1–5 done |
| 2 Reliability | Outbox, job queue, webhooks, property tests, Porcupine, fault injection | "I broke it on purpose; here's the proof" | — |
| 3 Scalability | k6 benchmarks, profiling, budget leases if measured | Real numbers in the README | — |
| 4 Polish | Dashboard, Python SDK, runaway-agent demo, one-VM deploy | A stranger runs it in 5 minutes | — |

## Phase 1 slices

1. ✅ **DB plumbing**: migrations, two role-scoped pools, RLS, test databases, CI.
2. ✅ **Reserve**: budget tree, periods, path locking, ledger posting.
3. ✅ **Idempotency**: key in the same transaction; concurrent duplicates replay.
4. ✅ **Settle / release / extend**: state machine, overrun and freeze, late settles.
5. ✅ **Sweeper**: `SKIP LOCKED`, database clock, `loadline worker`; auditor and `loadline audit`.
6. ⏳ **HTTP API**: `openapi.yaml`, scoped API keys, problem+json, usage events, Redis GCRA rate limits.
7. ⏳ **Demo + README**: `loadline explain`, metrics, tracing, a runaway-agent demo.

## Deliberately not building

Microservices, Kafka, Kubernetes, multi-region, invoicing or payments, Redis
as the money store, and anything ML. Each adds complexity without adding the
depth this project is about.
