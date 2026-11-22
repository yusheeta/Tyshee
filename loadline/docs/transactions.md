# Transaction design

Every operation that moves money is one short `READ COMMITTED` transaction
with explicit row locks. No network call ever happens inside one.

## The global lock order

Every transaction acquires locks in this order, and only this order:

1. the idempotency key row (`INSERT … ON CONFLICT DO NOTHING`)
2. the reservation row (`UPDATE … WHERE state = 'HELD'`, or `FOR UPDATE SKIP LOCKED` in the sweeper)
3. the late-settle row, if any
4. `node_balances` rows, in **ascending `node_id`** (`SELECT … ORDER BY node_id FOR UPDATE`)

With one total order there can be no wait cycle, so no deadlocks. The
concurrency tests assert Postgres's deadlock counter does not move.

The order matters. In a mutation test with the `FOR UPDATE` removed, the
1,200-request test logged 553 deadlocks and never finished. See
`bug-journal.md`.

## T1: Reserve

```sql
BEGIN;  -- READ COMMITTED, app.tenant_id set
INSERT INTO idempotency_keys (...) VALUES (...) ON CONFLICT DO NOTHING;
  -- 0 rows: a committed duplicate exists; compare the hash and replay or 422
SAVEPOINT effect;
SELECT ancestor_ids, now() FROM budget_nodes WHERE id = $leaf;
SELECT ... FROM node_balances JOIN unnest($ids, $periods) ... ORDER BY node_id FOR UPDATE OF b;
  -- fewer rows than path: the period is not open -> roll back, open it in its own txn, retry
  -- Go: check frozen and headroom leaf-first; 402 names the most specific node
UPDATE node_balances SET held = held + $amount ...;        -- one statement, every level
INSERT INTO reservations ... RETURNING id;
INSERT INTO reservation_holds ...;                           -- one row per level, with its period
INSERT INTO ledger_transactions / ledger_entries ...;        -- available -> held, per level
RELEASE SAVEPOINT effect;
UPDATE idempotency_keys SET response_code, response_body ...;
COMMIT;  -- the deferred trigger checks every journal transaction sums to zero
```

A business outcome (402, 404, 409) rolls back to the savepoint, so nothing
partial survives, and is then stored on the key, so retries replay it.

## T2: Settle(actual)

1. `UPDATE reservations SET state = 'SETTLED' … WHERE id = $1 AND state = 'HELD'`.
2. If 0 rows: re-read. SETTLED with the same amount returns the stored
   result; a different amount is 409. EXPIRED becomes a **late settle** (T3).
   RELEASED is 409.
3. Lock the hold rows' balances in ascending `node_id`. Per level:
   `held -= hold`, `consumed += actual`. Anything past `allocated + overdraft`
   becomes `overrun` and sets `frozen`.
4. Journal per level: held `-hold`, consumed `+actual`, available `+(hold - actual)`.

## T3: Late settle

The reservation stays EXPIRED (I5). Insert into `late_settles` (primary key
on the reservation, so at most once), lock balances, `consumed += actual`,
charge any overrun, and journal available `-actual`, consumed `+actual`.

## T4: Release and T5: Expire

Both move held back to available. Release is `WHERE state = 'HELD'`. The
sweeper first claims with `SELECT … WHERE state = 'HELD' AND expires_at < now()
FOR UPDATE SKIP LOCKED`, so it never waits on a settle in progress and
several sweepers never collide. Expiry uses the database clock only.

## T6: Extend

`expires_at = greatest(expires_at, least(now() + ttl, max_expires_at))` with
`WHERE state = 'HELD' AND expires_at > now()`. A hold past its expiry cannot
be extended, even before the sweeper reaches it.

## T7: Open a period

Runs in its own short transaction, outside the reserve (Phase 0 refinement 2).
Nodes in ascending `node_id`; ledger accounts and the balance row are
`ON CONFLICT DO NOTHING`; only the transaction that inserted the balance row
posts the grant (external → available). Safe to run concurrently.

## Races, and who wins

| Race | Resolution |
|------|------------|
| Settle vs sweeper | Both update `WHERE state = 'HELD'`; the row lock picks one. A settle that loses becomes a late settle. Tested 300 at a time. |
| Duplicate requests in flight | The second `INSERT` into `idempotency_keys` blocks on the primary key, then sees the committed row and replays. No in-progress state needed. |
| 1,200 reserves on one tree | All queue on the root row in node order; exactly the budget is admitted. |
| Period rollover mid-reserve | The lock finds a missing period row; the reserve rolls back, T7 opens the period, the reserve retries (at most 3 times). |
| Clock skew between servers | No effect: only Postgres's `now()` is used. |
