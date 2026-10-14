---
name: nestjs-code-review
description: Review NestJS / TypeScript backend code against coding conventions — architecture & layering, naming & style, validation & error handling, database/performance, and tests — and produce a severity-ranked report (Critical/Major/Minor/Nit) with file:line, the concrete failure scenario, and a fix. Use this whenever the user asks to review, audit, check, critique or "soi" NestJS code — a module, a PR, a diff, staged changes, or code an AI just generated — or asks whether code follows conventions / best practices / clean architecture. Trigger even if the user doesn't say "NestJS" but the code uses @nestjs decorators, DTOs with class-validator, or Prisma/TypeORM repositories. Applies project-specific rules from CLAUDE.md / AGENTS.md / CONTRIBUTING on top of generic conventions.
---

# NestJS Code Review

The goal is to catch what a senior NestJS reviewer would catch, with low noise. A review that
buries two real bugs under thirty nits is a bad review: the author fixes the nits and ships the
bugs. Rank ruthlessly, ground every finding in the code, and make each fix copy-pasteable.

## 1. Establish the scope

- If the user named files, a module, a PR or a commit range, review exactly that.
- Otherwise run `git status` and `git diff` (staged + unstaged; for a branch, `git diff <base>...HEAD`).
  Review the changed code. If there are no changes and no target, ask what to review.
- Read surrounding code (callers, the module file, `main.ts` / app setup, the Prisma schema or
  entities) as needed to understand behaviour, but **report on the code in scope**. Mention a
  pre-existing problem only if it is severe and directly related, and label it `(pre-existing)`.
- In a diff, separate behaviour changes from noise (renames, moved code, formatting). Skim the
  noise, but read every behaviour change line by line — subtle bugs hide next to a large rename.
  For each changed method, compare it with its unchanged siblings: a method that drops a filter
  its siblings have (`where: { id }` vs `where: { id, ownerId }`) is a classic regression.

## 2. Load project rules first — they override generic conventions

Look for `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/adr*`, `.eslintrc*`, and any
"conventions" section in the README. Extract concrete rules (layering, folder placement, error
format, naming, how units/time/money are handled, etc.).

- When a project rule conflicts with a generic convention, the project rule wins.
- Cite the source in the finding: `Rule: CLAUDE.md — "Repositories are the only place that touches Prisma"`.
- Consistency with neighbouring code is itself a convention: if every module uses
  `*.repository.ts` and the new one queries Prisma from the service, that's a finding even if
  no document says so.

## 3. Read and analyze

Read `references/nestjs-checklist.md` at the start of every review — it's the detailed checklist
(categories A–E with bad/good examples). Then read every file in scope fully, and walk the data
flow end to end:

`HTTP request → DTO/pipes → controller → service → repository → DB → mapper → response`

Most real bugs live at the boundaries of that chain: unvalidated input crossing into the service,
DB errors leaking out as 500s, entity objects leaking into responses, multi-step writes without a
transaction, time/unit conversions done in the wrong layer.

## 4. Verify before you report

Every finding must point at specific lines and survive a quick check:

- "Input isn't validated" → confirm there's no global `ValidationPipe` (check `main.ts` / app
  setup) and no pipe on the parameter.
- "N+1 query" → show the loop and the query inside it.
- "Missing transaction" → name the two writes that can diverge and what state is left behind.
- "Unused / dead code" → search for usages first.
- Don't report what the linter/formatter already enforces (unless the config is missing).

If you can't confirm something, either check it or put it under **Questions** — not as a finding.
Accuracy matters more than volume; a wrong finding costs the author time and costs the review
credibility.

## 5. Assign severity

| Severity | Meaning | Examples |
|---|---|---|
| 🔴 **Critical** | Wrong behaviour, data loss/corruption, security hole or crash in realistic use. Must fix before merge. | SQL injection via `$queryRawUnsafe`; multi-table write without a transaction; secrets/stack traces in responses; `await` missing on a write |
| 🟠 **Major** | Likely bug in edge cases, or a design violation that will spread if merged. | Prisma used in a controller; no validation at the boundary; unbounded `findMany` on a large table; core business logic with no tests; HTTP exceptions thrown from domain code |
| 🟡 **Minor** | Maintainability / clarity / small inconsistency. | Misleading name; magic number; missing explicit return type on a public method; duplicated helper |
| ⚪ **Nit** | Taste. Optional. | Import order, wording of a comment |

Cap nits at about five and group them in one list. If there are no Critical or Major findings,
say so plainly — "no blocking issues" is a useful result, don't inflate minor points to fill space.

## 6. Write the report

Write the report in the user's language (if they wrote in Vietnamese, write in Vietnamese); keep
code identifiers, file paths and rule names in English. Use this template and omit empty sections:

````markdown
# Code review: <scope, e.g. "src/modules/orders (4 files)">

**Verdict:** 🔴 Request changes | 🟡 Approve with comments | ✅ Approve
<1–2 sentences: overall quality and the single most important risk.>

| 🔴 Critical | 🟠 Major | 🟡 Minor | ⚪ Nit |
|---|---|---|---|
| 1 | 3 | 2 | 4 |

## 🔴 Critical

### C1. <Short title> — `src/modules/orders/orders.service.ts:42`
**Rule:** <checklist item or project rule + source>
**Problem:** <What is wrong and the concrete failure scenario: input/state → wrong result.>
**Fix:**
```ts
// minimal corrected code, not a rewrite of the whole file
```

## 🟠 Major
### M1. … (same block as Critical)

## 🟡 Minor
- **m1.** `file.ts:30` — <problem in one sentence> → <fix in one sentence or a one-line snippet>.

## ⚪ Nits
- `file.ts:12` — …

## 👍 Done well
- <2–3 specific things worth keeping, so the author knows what not to change.>

## ❓ Questions
- <At most 3: things you couldn't verify, or intent you need clarified.>
````

Number findings (C1, M1, m1) so the author can reply "fixed M2". Spend words where the risk is:
only Critical and Major get the full Rule/Problem/Fix block; Minor findings and nits are one-line
bullets. Keep each block tight — the failure scenario in one or two sentences and the smallest
fix that works. Don't restate the checklist or repeat the same root cause across findings;
reference the earlier finding instead ("same root cause as C2").

## 7. After the report

Do not modify code during the review. End by offering to apply the fixes (e.g. "Muốn mình sửa
các mục Critical + Major không?"). If the user agrees, fix in severity order and re-run the
project's lint/typecheck/tests.
