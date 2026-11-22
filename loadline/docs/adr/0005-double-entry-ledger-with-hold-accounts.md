# ADR 0005 (D5): A double-entry ledger with holds as accounts

Status: accepted, 2026-11-22

## Decision

Each node has available, held and consumed accounts per period; each tenant has an external account. Grant: external → available. Reserve: available → held. Settle: held → consumed, the rest back to available. Release and expire: held → available. Integer micro-credits only. `node_balances` is a projection written in the same transaction.

## Rejected

A single balance column (no audit trail, so no way to explain a balance); full event sourcing (more machinery than needed).

## Why

Every change is explainable, and I2 and I3 become sums the auditor checks.

## Costs and limits

About two or three entry rows per level per operation. The journal will be partitioned by month (Phase 3). The projection must keep being proved correct, so the auditor runs after every test and on a schedule.
