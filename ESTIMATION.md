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
Approximate active time, reconstructed from session and commit timestamps (Wed 2026-10-14,
11:30–21:30 local, minus a ~5 h pause). AI-assisted throughout.

| Milestone | Estimate | Actual | Notes |
|---|---|---|---|
| M0 Setup | 1.5h | ~0.5h | Plan revised once after review (reusable-code layer) |
| M1 Foundation | 2h | ~0.7h | Two bugs found by e2e / Docker smoke test (body-parser errors, request id) |
| M2 Data layer | 2.5h | ~0.6h | Dropped generated columns (Prisma drift) |
| — Review tooling | not planned | ~1h | Review skill + 2 eval iterations + reviewer agent; paid off in every later milestone |
| M3 Log workouts | 2.5h | ~1h | Incl. M3 review fixes (DST gap bug) |
| M4 History | 2.5h | ~0.7h | Incl. M4 review fixes |
| M5 Personal records | 3h | ~0.7h | |
| M6 Performance | 1.5h | ~0.4h | Seed + EXPLAIN answered a review question directly |
| M7 Docs | 2h | ~0.5h | |
| **Total** | **17.5h** | **~6h** | Video not included |

The estimate assumed mostly manual coding with AI help; in practice the agent wrote the code and
the time went into specification, review and verification. The biggest under-estimate was review
tooling, which wasn't in the plan at all.
