# Time Estimation

Estimated **before** starting implementation (Wed 2026-10-14). Deadline: Fri 2026-10-16.

| # | Milestone | Scope | Estimate |
|---|---|---|---|
| M0 | Setup | Read spec, plan, folder structure, CLAUDE.md, NestJS scaffold | 1.5h |
| M1 | Foundation | Config + env validation, structured logging, Prisma module, Docker/compose, global error filter + error codes | 2h |
| M2 | Data layer | Unit registry + converter, Prisma schema, hand-written migration (generated columns, pg_trgm, indexes), exercise catalog loader | 2.5h |
| M3 | Log workouts | Bulk POST, validation, transaction, idempotency, e2e tests | 2.5h |
| M4 | History | Filters (partial name, date range, muscle group), cursor pagination, unit output, e2e tests | 2.5h |
| M5 | Personal records | Max weight / volume / Epley 1RM with dates, period comparison, timezone-aware periods, tests | 3h |
| M6 | Performance | 50k+ seed script, EXPLAIN ANALYZE, index tuning | 1.5h |
| M7 | Docs | README (architecture diagram, API, schema, trade-offs, scaling), AI_WORKFLOW.md | 2h |
|   | **Total (code + docs)** | | **~17.5h** |
|   | Video walkthrough | Recording + retakes (15–20 min video) | 1.5h |

## Assumptions
- AI-assisted implementation (Claude Code) with human review of every milestone.
- No authentication; `userId` is passed as a path parameter.
- Single region, single Postgres instance; scaling notes go in the README rather than code.

## Risks
- Prisma does not model generated columns / `pg_trgm` natively → hand-written SQL migration (+0.5h buffer).
- Timezone-aware period boundaries (DST, month ends) are easy to get subtly wrong → dedicated unit tests.

## Actual (filled in after completion)
| Milestone | Actual | Notes |
|---|---|---|
| M0 | | |
| M1 | | |
| M2 | | |
| M3 | | |
| M4 | | |
| M5 | | |
| M6 | | |
| M7 | | |
