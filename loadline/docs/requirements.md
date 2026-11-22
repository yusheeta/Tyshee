# Requirements

**Loadline is real-time spend control for AI agents.** Before an expensive
call (an LLM request, a tool run) an agent reserves budget; afterwards it
settles the actual cost. No agent, project or team can ever spend past its
budget, even with hundreds of concurrent requests and crashes along the way.

## Functional

- **Budget tree** per tenant: up to 4 levels (org → project → agent → …).
  Each node has a limit, an optional overdraft and a period (daily, monthly, none).
- **Reserve** an amount on a leaf: held atomically on every node of its path, or on none.
  A rejection (402) names the most specific node that blocked it and its headroom.
- **Settle** the actual amount, **release** an unused hold, **extend** a live hold.
- Holds **expire** after their TTL (default 60 s, at most 15 min per extend, 1 h lifetime).
- A **late settle** (after expiry) is recorded in full; usage past limit + overdraft is overrun and freezes the node until the period resets or it is topped up.
- **Idempotency-Key** is required on every mutating call; retries never charge twice.
- **Ledger**: double-entry, append-only, auditable on demand.
- **API keys** scoped per tenant (Phase 1, slice 6); per-key **rate limits** in Redis (fail open).
- **Webhooks** for budget thresholds (80 %, 100 %) via a transactional outbox (Phase 2).

## Non-functional

- Correctness first: invariants I1–I9 (`invariants.md`) hold under any concurrency and any crash.
- Reserve p99 under 25 ms for spread load on a 4-vCPU VM (to be measured, Phase 3).
- One Postgres 16 is the only authority for money; Redis never decides about money.
- Runs with `docker compose up` on one VM.

## Units

Money is integer **micro-credits** (`1 credit = 1,000,000`). Tenants map
their own prices to credits; Loadline does no currency or pricing logic.
