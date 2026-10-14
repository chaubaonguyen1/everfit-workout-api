# CLAUDE.md — rules for AI assistants working in this repo

This file is loaded into every AI coding session. It is the "system prompt" for the project.

## Project
Workout Logging API for Everfit (backend take-home). Coaches track client workout metrics:
log workouts (bulk, unit conversion), query history (filters, cursor pagination, unit output),
and compute personal records (max weight, max volume, Epley 1RM, period comparison).

Stack: NestJS 11 (CommonJS) · TypeScript 5 (strict) · PostgreSQL 16 · Prisma 6 · Jest + supertest · Docker.

## Architecture rules (non-negotiable)
- Feature modules live in `src/modules/<feature>/` with layers: **controller → service → repository**.
  - Controllers: HTTP only (DTO in, response DTO out). No business logic, no Prisma.
  - Services: orchestration + business rules. Depend on repositories and domain functions.
  - Repositories: the **only** place that touches Prisma / SQL.
    (Exception: `HealthController` calls `PrismaService.ping()` — an infrastructure probe,
    not business data access.)
- `src/modules/<feature>/domain/` and `src/common/utils/` hold **pure functions** — no imports
  from `@nestjs/*` or `@prisma/*` (enforced by ESLint). Every pure function has a `*.spec.ts` next to it.
- Reusable code placement:
  - pure, generic → `src/common/utils/`
  - needs infra (Prisma, Nest) → `src/common/helpers/`
  - request-level reuse → `src/common/decorators/`, `src/common/pipes/`
  - raw Express concerns that must run before Nest (request id, body-parser errors) → `src/common/middleware/`
  - feature-specific business formula → `src/modules/<feature>/domain/`
  - Used by ≥ 2 modules → move to `common/`.
- Weight units come from `modules/units/domain/weight-unit.registry.ts`. Never hardcode `'kg' | 'lb'`
  elsewhere; adding a unit must be a one-line change in the registry.
- Exercise → muscle group mapping comes from `config/exercise-catalog.json`. Never hardcode it.

## Data & time
- Store all timestamps as UTC (`timestamptz`). Accept ISO-8601 with offset, or date + IANA timezone.
- Store original weight + unit **and** normalized `weight_kg`. Convert only at the edges.
- Round only for presentation (`roundTo`), never before persisting.

## Errors
- Throw `DomainError` subclasses with a code from `common/errors/error-codes.ts`.
- Every error response has the shape `{ error: { code, message, details? }, requestId }`.
- "No data in range" is **not** an error: return 200 with empty data and a `message`.

## Code style
- TypeScript strict, no `any`. Prefer `readonly` and explicit return types on public methods.
- Small functions, early returns, descriptive names. Comments explain *why*, not *what*.
- Follow existing patterns in neighbouring files before introducing new ones.

## Workflow
- Work milestone by milestone (see plan). Keep each change small enough to review in one sitting.
- Do not commit; the human reviews and commits.
- When unsure about a requirement, ask instead of guessing.
- Run `npm run lint && npm run typecheck && npm test` before declaring a step done.
