# Bug journal

Every bug the tests catch, with its root cause. Newest first.

| Date | Found by | What happened | Root cause | Lesson |
|------|----------|---------------|------------|--------|
| 2026-11-22 | Mutation run of `TestConcurrentReservesAdmitExactly600` (removed `FOR UPDATE` from the balance lock) | 553 deadlocks logged; the test never finished. The `held + consumed <= limit` CHECK did **not** fire. | Without the ordered lock, the multi-row `UPDATE` takes row locks in arbitrary order (deadlocks), and writing absolute values computed from an unlocked read is a lost update. The CHECK only sees each row's final value, so it can't see a lost update. | The CHECK constraint is a backstop, not the mechanism. The auditor's "held equals the sum of live holds" check is what catches lost updates. |
