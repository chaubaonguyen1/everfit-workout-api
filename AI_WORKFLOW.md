# AI workflow

Raw, chronological notes are in [`docs/ai-notes.md`](docs/ai-notes.md); the independent review
reports are in [`docs/reviews/`](docs/reviews). This file is the summary.

## Tools and what they were used for

| Tool | Used for |
|---|---|
| **Claude Code** (Claude Opus, agentic CLI) | Reading the spec, planning (plan mode), architecture and schema design, writing nearly all code, tests, migrations, Docker setup, running lint/tests/Docker/`EXPLAIN`, debugging, documentation |
| **Reviewer agent** — `.claude/agents/nestjs-reviewer.md` | A separate Claude instance with a fresh context and read-only tools, run after every milestone to review the diff before it was pushed |
| **Review skill** — `.claude/skills/nestjs-code-review/` | The reviewer's checklist (architecture, naming, validation/errors, DB/performance, tests), severity scale and report template |
| **skill-creator eval harness** | Measuring the review skill against code with planted bugs, with vs without the skill |

No code was taken from other AI tools. Roughly 95% of the code was AI-generated; every milestone
went through automated checks and an independent agent review, and every finding was triaged
before the code was pushed.

## The loop used for every milestone

1. **Plan first.** The spec was turned into a plan (folder structure, schema, API, milestones)
   in plan mode and approved before any code. My first review of the plan changed it (see
   example 1 below).
2. **Implement one milestone** with unit tests for every pure function and e2e tests against a
   real Postgres.
3. **Verify mechanically:** `lint`, `typecheck`, unit, e2e, then a `docker compose up` smoke test
   with `curl` — several bugs were only found at this step.
4. **Independent review:** the reviewer agent gets the commit range, the spec requirements and the
   previous reviews, and writes a report to `docs/reviews/`.
5. **Triage every finding** — accept, defer to the milestone that needs it, or reject with a
   reason — and record the decision in `docs/ai-notes.md`. Claims were reproduced before fixing
   (e.g. the DST bug) and performance claims were measured before acting (`EXPLAIN`).
6. **Small commits** with messages that explain *why*, then push.

## Prompting strategy

- **Rules file as the system prompt.** [`CLAUDE.md`](CLAUDE.md) is loaded into every session: the
  layering rules (controller → service → repository, pure `domain/`), where reusable code goes,
  "units only from the registry", "store UTC", "round only for presentation", the error contract
  and "empty is not an error". Rules that can be enforced were turned into ESLint rules
  (`@nestjs/*` / `@prisma/*` imports are lint errors in `domain/`, `common/utils`, `common/errors`).
- **Full context, small steps.** The whole spec was given up front, but work was split into
  milestones (M0 setup → M7 docs) with a stop for review after each; the agent was told not to
  commit on its own.
- **Ask, don't guess.** Decisions that were mine (database, ORM, deadline, who writes code,
  GitHub account, commit author) were asked as explicit questions rather than assumed.
- **Fresh context for review.** The reviewer prompt contains only the scope, the spec
  requirements relevant to that milestone, and pointers to earlier reviews ("don't repeat these").
  It reviews *committed* code via `git show`, so it can run while the next milestone is being written.
- **Evaluate the prompt, not just the output.** The review skill was improved with evals: four
  fixtures with planted bugs, with and without the skill, two iterations (details below).

## Where the AI was wrong or suboptimal, and how it was caught

1. **The plan had no home for reusable helpers.** The first folder structure only had
   `common/pagination` and `common/validators`. I asked for a layer like React's custom hooks; it
   became `common/utils` (pure), `common/helpers` (infra-aware), `common/decorators` + `pipes`
   (request-level), with the rule "used by ≥ 2 modules → `common/`" — later applied when the
   date-range parser moved to `common/utils` for personal records.
2. **A unit test that encoded the AI's own wrong assumption.** The exception filter detected
   malformed JSON by body-parser's `err.type`. Its unit test (hand-made error object) passed; the
   e2e returned `VALIDATION_ERROR`. Debugged by temporarily logging the exception in the filter —
   it was a `BadRequestException` — and then reading Nest's source: `routes-resolver.js` converts
   every `SyntaxError` and drops `type`. Fixed with an Express error middleware that runs before
   Nest. Lesson: mocks reproduce the author's assumptions; test against the real stack.
3. **Second-order bug found only in the Docker smoke test:** that `MALFORMED_JSON` response had no
   `requestId`, because pino-http (which assigned ids) runs after the body parser. Moved id
   assignment into the first Express middleware and added an e2e assertion.
4. **A real data bug in time-zone code (found by the reviewer agent).** In zones whose DST change
   skips midnight (`America/Santiago`), a date-only `2026-09-06` was stored as 23:00 on Sep 5 — the
   workout moved to the previous day. The AI's DST tests only covered times *after* a transition.
   Reproduced with the built code first, then fixed with "compatible" disambiguation and a
   full-year test that a date-only input never changes local day in four DST zones.
5. **Missing tie-break (found by the reviewer agent).** PR indexes ordered by
   `metric DESC, performed_at`, but all sets of one entry share `performed_at`, so equal sets
   inside an entry came back in arbitrary order. Added `id` to the three PR indexes.
6. **A concurrency test that proved less than its name.** "Same request sent concurrently" also
   passed if requests ran one after another. Added a deterministic test that holds an uncommitted
   idempotency claim in an open transaction and asserts the HTTP request stays pending until
   rollback.
7. **Outdated knowledge.** The AI pinned NestJS 10 from memory; `npm install` failed. Checked the
   registry: Nest 12 is ESM-only (painful with Jest), so Nest 11 (CommonJS) was chosen. Since then
   versions are checked against the registry, not training data.
8. **Dead code after refactors.** Moving presentation into pure functions left
   `UnitConverterService` unused, so the documented `UNSUPPORTED_UNIT` error could never be
   returned. Caught while checking which error codes are really emitted before writing the
   README; removed.

## Suggestions that were rejected, and why

| Suggestion | From | Why it was rejected |
|---|---|---|
| Store `volume_kg`/`e1rm_kg` as Postgres **generated columns** | My own plan (AI-written) | Prisma can't model generated columns, so the next `migrate dev` would try to drop them; the formula would also live in SQL and TS. Computed at write time in one tested TS function instead. |
| A **`RequestIdInterceptor`** | AI's plan | Interceptors run after the body parser, so the id would be missing on exactly the errors that are hardest to debug. Used first-in-chain Express middleware. |
| **Canonicalize stored time zones** with `Intl.resolvedOptions()` | Reviewer (M3) | Checked first: Node's ICU returns legacy ids (`Asia/Ho_Chi_Minh` → `Asia/Saigon`), so clients would get back a different name than they sent. Kept their spelling, only bounded the formatter cache. |
| Rewrite history filtering as a per-exercise **`LATERAL` merge** | Reviewer (M4, Major) | Measured on 60k entries: the planner already chooses the right index; worst case 0.35 ms. Kept the simpler query and adopted the cheaper half of the advice (only exercises the user has logged). |
| **Composite FK** to keep denormalized set columns in sync | Reviewer (M0–M2) | Entries are immutable (no update endpoint); documented as a trade-off instead. |
| **Inject a Clock** | Reviewer (M3) | The only time-dependent logic (`prepareEntries`) already takes `now` and is pure. |

The reviewer was also wrong once: it claimed `isWeightUnit` had no tests (they live in
`weight-conversion.spec.ts`) — it inferred from file names instead of checking.

## Building and measuring the review skill

The review skill was evaluated on four fixtures with planted bugs: a generic NestJS module (SQL
injection, missing transaction, `forEach(async)`, leaked `passwordHash`, …), a module violating
this repo's `CLAUDE.md`, a clean module (to catch false positives), and a git branch whose subtle
bugs (`this.prisma` inside `$transaction`, cursor without tie-break, IDOR in one method) hide
among rename noise.

| Iteration | With skill | Without skill | Notes |
|---|---|---|---|
| 1 | 100% of assertions | 96% | Baseline found the planted bugs too; skill mainly improved consistency (severity, file:line). Baseline caught IDOR and a tie-break issue the skill missed → added checklist items. |
| 2 | 100% | 97.5% | Skill reviews had about half as many findings (less noise) and were faster (85 s vs 94 s), at +18% tokens. |

Honest conclusion: a strong model already finds most bugs; the skill's value is calibrated
severity, less noise, and project-rule awareness. Its real payoff came from running it as an
**independent agent** after each milestone — that is what caught the DST and tie-break bugs.

## What I'd do differently

- Commit from the first minute: M0–M2 were split into commits after the fact (same timestamp);
  from M3 on, every step was committed as soon as its tests passed.
- Write the "proof" tests (deterministic concurrency, cross-time-zone fixtures) together with the
  feature, not after review.
- Run the 50k-row benchmark earlier — it answered a design question (the LATERAL rewrite) that
  otherwise would have been decided by intuition.
