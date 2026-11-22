# Schema

The source of truth is [`migrations/0001_init.sql`](../migrations/0001_init.sql);
this page explains it.

| Table | Purpose | Key guards |
|-------|---------|------------|
| `tenants`, `api_keys` | Who is calling | Created by the system role only |
| `budget_nodes` | The tree, `ancestor_ids` = path root → self | Depth 1–4; parent in the same tenant (composite FK) |
| `node_balances` | Hot rows, one per node per period | I1 CHECK; `overrun` only when `frozen` |
| `reservations` | One per reserve | Only HELD may change (trigger); never deleted |
| `reservation_holds` | One row per level, with its period | Append-only |
| `late_settles` | Usage reported after expiry | Primary key = at most once |
| `ledger_accounts` | available / held / consumed per node-period; one external per tenant | Unique per (node, period, kind) |
| `ledger_transactions`, `ledger_entries` | The journal | Append-only, no truncate, sums to zero at commit |
| `idempotency_keys` | Stored response per (tenant, key) | Inserted in the effect's transaction |
| `usage_events` | Direct charges (slice 6) | Primary key = counts once (I7) |

## Roles

| Role | Used by | Row-level security |
|------|---------|--------------------|
| `loadline_app` | API | Yes: `tenant_id = current_setting('app.tenant_id')`, raises when unset |
| `loadline_system` | Worker, auditor, admin | Bypasses RLS; still bound by triggers, CHECKs and grants |

History tables (`ledger_*`, `reservation_holds`, `late_settles`) have no
UPDATE grant for either role, and triggers reject UPDATE, DELETE and
TRUNCATE even for the owner.
