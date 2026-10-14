# NestJS review checklist

Generic conventions. Project rules (CLAUDE.md etc.) override anything here.
Each item lists the typical severity in brackets — adjust to the actual impact.

**Contents**
- A. Architecture & layering
- B. Naming & style
- C. Validation & error handling
- D. Database & performance
- E. Testing

---

## A. Architecture & layering

**A1. Thin controllers** [Major] — Controllers map HTTP ↔ application calls: read params/DTOs,
call one service method, return a response DTO. No business rules, no DB access, no
cross-service orchestration.

```ts
// ❌ business logic + persistence in the controller
@Post()
async create(@Body() dto: CreateOrderDto) {
  const total = dto.items.reduce((s, i) => s + i.price * i.qty, 0);
  return this.prisma.order.create({ data: { ...dto, total } });
}
// ✅
@Post()
create(@Body() dto: CreateOrderDto): Promise<OrderResponse> {
  return this.orders.create(dto);
}
```

**A2. Data access only in repositories** [Major] — Prisma/TypeORM/Mongoose calls live in a
repository (or a clearly designated data-access class). Services depend on the repository, which
keeps queries in one place, testable and swappable.

**A3. Pure domain logic** [Major] — Calculations and business rules (pricing, conversions,
scoring) are plain functions/classes with no `@nestjs/*`, ORM or HTTP imports, so they can be
unit-tested without a Nest container.

**A4. No HTTP concerns below the controller** [Major] — Services/domain should not throw
`HttpException`/`NotFoundException` or know status codes. Throw domain errors and map them to
HTTP in one exception filter. (Acceptable in very small apps if it's the established pattern —
check consistency.)

**A5. Dependency injection, not `new`** [Major] — Injectable collaborators come through the
constructor. `new SomeService()` inside a provider breaks DI, config and testing.
Use `private readonly` constructor params.

**A6. Module boundaries** [Minor→Major] — A module exports only what others need. Importing another
module's repository or internal file directly (`../orders/orders.repository`) bypasses its public
service. Watch for circular imports / `forwardRef` used to paper over a design problem.

**A7. Configuration through `ConfigService`** [Major] — No `process.env.X` scattered in services;
validate env at boot (fail fast) and read typed config. No hardcoded URLs, secrets or tunables.

**A8. Response shaping** [Major] — Don't return ORM entities/records directly: they leak internal
columns (password hashes, internal ids, `deletedAt`) and couple the API to the schema. Map to a
response DTO.

**A9. Reuse before re-implementing** [Minor] — Check `common/`, `utils/`, `helpers/` for an
existing helper before accepting a new one; duplicated logic drifts.

## B. Naming & style

**B1. File and symbol naming** [Minor] — kebab-case files with role suffix:
`orders.controller.ts`, `orders.service.ts`, `orders.repository.ts`, `create-order.dto.ts`,
`order.response.ts`, `orders.module.ts`, `*.spec.ts`, `*.e2e-spec.ts`. Classes in PascalCase
with matching suffix (`OrdersService`, `CreateOrderDto`). Methods are verbs (`findById`,
`calculateTotal`); booleans read as predicates (`isActive`, `hasAccess`).

**B2. No `any`, no unchecked casts** [Minor→Major] — `any` and `as Foo` on external data disable
the type checker exactly where bugs enter. Use `unknown` + narrowing, generics, or typed DTOs.

**B3. Explicit return types on public methods** [Minor] — Especially controllers/services; keeps
the API contract stable and catches accidental `Promise<any>`.

**B4. Immutability** [Nit→Minor] — `readonly` for injected deps and DTO/response fields; `const`
over `let`; avoid mutating arguments.

**B5. Small functions, early returns** [Minor] — Deep nesting or 80-line methods hide edge cases.
Extract named helpers.

**B6. Magic values** [Minor] — Literals with meaning (`0.45359237`, `100`, `'kg'`) become named
constants or come from config/registries.

**B7. Comments explain why** [Nit] — Not what the code says. Flag stale or misleading comments
(those are Minor: they actively mislead).

**B8. Async hygiene** [Critical when it loses writes] — Every promise is awaited or deliberately
handled; no `forEach(async …)` (it doesn't wait); no floating promises in request paths.

```ts
// ❌ returns before the writes finish; errors become unhandled rejections
items.forEach(async (i) => await this.repo.save(i));
// ✅
await Promise.all(items.map((i) => this.repo.save(i)));   // or a single bulk insert
```

## C. Validation & error handling

**C1. Validate at the boundary** [Major] — Every body/query/param has a DTO with
`class-validator` decorators, and a global `ValidationPipe` with `whitelist: true`,
`forbidNonWhitelisted: true`, `transform: true` exists. Nested objects need
`@ValidateNested()` + `@Type(() => Child)` — without `@Type` the nested rules silently don't run.
Arrays need `@IsArray()`, `@ArrayMinSize/MaxSize` (bound bulk payloads).

```ts
// ❌ nested items are never validated
@IsArray() items: OrderItemDto[];
// ✅
@IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
@ValidateNested({ each: true }) @Type(() => OrderItemDto)
items: OrderItemDto[];
```

**C2. Numbers, dates, enums** [Major] — Query params arrive as strings: use `@Type(() => Number)`
or `ParseIntPipe`. Dates: `@IsISO8601()` and an explicit timezone strategy. Ranges: check
`from <= to`. Enums: validate against the source-of-truth list, not a copied literal.

**C3. Consistent error contract** [Major] — One global exception filter producing one shape
(e.g. `{ error: { code, message, details }, requestId }`). Machine-readable `code`s, human
`message`s. No ad-hoc `res.status(400).json(...)` in controllers.

**C4. Don't leak internals** [Critical] — Unknown errors become an opaque 500 and are logged
server-side with stack. Never return `err.message` from DB/driver errors, stack traces, SQL, or
connection strings.

**C5. Map known DB errors** [Major] — Unique violations (Prisma `P2002`), FK violations (`P2003`),
not found (`P2025`) become 409/400/404 with a clear code — not a 500.

**C6. Don't swallow errors** [Major] — Empty `catch {}` or `catch (e) { return null }` hides
failures. Catch only what you can handle; otherwise let it reach the filter. Watch for the
disguised form: a DB outage caught and turned into `null` → the caller answers 404 "not found"
for data that exists.

**C7. "Empty" is not an error** [Minor→Major] — A list/search with no results returns 200 with
`[]`, not 404. 404 is for a specific resource id that doesn't exist.

**C8. Status codes** [Minor] — 201 for creation, 204 for no content, 400 validation, 404 missing
resource, 409 conflict, 422 semantic rule violation (team-dependent), 500 unexpected.

**C9. Authorization & ownership (IDOR)** [Critical] — Every read/update/delete of a user-owned
resource must be scoped to its owner *in the query itself*, not just looked up by id. Fields that
define identity or trust (`userId`, `tenantId`, `role`, `price`, `status`) must not be taken from
the request body when the server can know them (auth context). Easy to miss in diffs: one method
filters `where: { id, ownerId }` and its sibling uses `where: { id }`.

```ts
// ❌ any coach can rename any template if they know/guess its id
return this.prisma.template.update({ where: { id }, data: { name } });
// ✅ ownership enforced atomically; count 0 → not found
const { count } = await this.prisma.template.updateMany({ where: { id, coachId }, data: { name } });
if (count === 0) throw new NotFoundError(`Template ${id} not found`);
```

Only treat auth as intentionally absent when the project says so explicitly (README, spec,
CLAUDE.md — e.g. "no authentication required, pass userId as a parameter"). In that case don't
report missing auth as Critical; still check that every query is scoped by the owner id the API
receives, and mention the gap at most once under Questions. If nothing documents it, missing
ownership checks or identity taken from the body are findings (usually Critical), not questions.

## D. Database & performance

**D1. Transactions for multi-step writes** [Critical] — Writes that must succeed or fail together
(order + items, entry + sets, debit + credit) run in one transaction
(`prisma.$transaction(async (tx) => …)`, using `tx` for every call inside).

```ts
// ❌ if the second call fails, an order without items remains
const order = await this.prisma.order.create({ data });
await this.prisma.orderItem.createMany({ data: items(order.id) });
// ✅
return this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data });
  await tx.orderItem.createMany({ data: items(order.id) });
  return order;
});
```

**D2. No N+1** [Major] — A query inside a loop over results. Use `include`/joins, `where: { id: { in: ids } }`,
or batch loading.

**D3. Bounded reads** [Major] — List endpoints paginate (cursor/keyset for large or append-heavy
tables; offset is fine for small ones) with a max page size. No unbounded `findMany()` on
user-scoped tables.

**D4. Index-aware queries** [Major at scale] — Filters/sorts used by hot endpoints have matching
composite indexes (column order = equality columns first, then range/sort). `ILIKE '%x%'` needs a
trigram index or is a full scan. Aggregations over large tables should be index-backed or
precomputed.

**D5. Select only what you need** [Minor] — `select` instead of fetching whole rows with large
columns, especially in lists.

**D6. Raw SQL safety** [Critical] — `$queryRaw` tagged template (parameterized) is fine;
`$queryRawUnsafe`/string concatenation with user input is SQL injection. LIKE patterns need
escaping of `%`/`_`.

**D7. Concurrency** [Major] — Read-modify-write sequences (check-then-insert, counters, "get max
then insert") race under concurrent requests. Use unique constraints + upsert/`ON CONFLICT`,
atomic updates (`increment`), or proper isolation. Retries need idempotency.

**D8. Numeric precision & units** [Major] — Money/weights: decide storage precision (DECIMAL vs
float), store normalized values, round only for presentation, never round before persisting.

**D9. Time** [Major] — Store UTC (`timestamptz`). Day/week/month boundaries depend on the user's
timezone — computing them with server-local `new Date().setHours(0)` is a bug.

**D10. Deterministic ordering & tie-breaks** [Major] — Any query whose result depends on order
needs a total order. Cursor/keyset pagination on a non-unique column (`createdAt`) skips or
repeats rows that share a value; add the primary key as tie-breaker in both `orderBy` and the
cursor predicate. "Find the max/first" without a tie-break (or `findMany` with no `orderBy`)
returns an arbitrary row among equals — e.g. which date a record was "achieved".

```ts
// ❌ rows with the same createdAt as the cursor are skipped
where: { createdAt: { lt: cursor.createdAt } }, orderBy: { createdAt: 'desc' }
// ✅ compound cursor (createdAt, id)
where: { OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }] },
orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
```

**D11. Transactions use the transaction client** [Critical] — Inside
`prisma.$transaction(async (tx) => …)`, every call must go through `tx`. A stray `this.prisma.x`
inside the callback runs on a different connection: outside the transaction, not rolled back,
and unable to see the transaction's uncommitted rows (FK violations or lock waits/deadlocks).

## E. Testing

**E1. Unit tests for logic** [Major if core logic is untested] — Pure functions and services with
branching get table-driven tests (`it.each`), including edge cases: zero, negative, empty,
boundaries, rounding, timezone/DST edges.

**E2. e2e/integration for endpoints** [Major] — At least the happy path + validation failure +
not-found/empty + one concurrency or idempotency case for write endpoints, against a real
database where feasible. Boot the app with the same global pipes/filters as production.

**E3. Test behaviour, not implementation** [Minor] — Assert on outputs and observable effects,
not on which private method was called. Over-mocking lets tests pass while production breaks
(mocks encode the author's — or the AI's — assumptions).

**E4. Deterministic tests** [Major] — No reliance on current time, random data or test order
without control (inject a clock, fixed seeds, isolated data per test, cleanup).

**E5. Meaningful names** [Nit] — `it('returns 200 with an empty list when the range has no data')`
over `it('works')`.
