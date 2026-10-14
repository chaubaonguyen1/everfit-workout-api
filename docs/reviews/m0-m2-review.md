# Code review: M0–M2 foundation (`src/**`, `test/**`, `prisma/**`, `config/exercise-catalog.json`, Docker, env, `package.json`)

**Verdict:** 🟡 Approve with comments
Nền móng chắc: error contract thống nhất, global `ValidationPipe` chặt, unit registry đúng tinh thần CLAUDE.md, schema có CHECK constraint và keyset index cho history. Không có lỗi blocking ở code hiện tại; rủi ro lớn nhất nằm ở **thiết kế index/tie-break cho Personal Records** và **việc chưa map lỗi Prisma** — cả hai sẽ thành bug thật ngay khi làm M3 (bulk logging, PR, period comparison).

| 🔴 Critical | 🟠 Major | 🟡 Minor | ⚪ Nit |
|---|---|---|---|
| 0 | 3 | 10 | 4 |

## 🟠 Major

### M1. PR index không có tie-break trong cùng một entry → "set đạt kỷ lục" là ngẫu nhiên — `prisma/schema.prisma:87-89`
**Rule:** Checklist D10 — Deterministic ordering & tie-breaks; schema comment tự cam kết "the FIRST time a record was achieved is reported".
**Problem:** `performed_at` được denormalize từ entry, nên mọi set trong cùng một entry có **cùng** `performed_at`. Ví dụ entry Bench Press 3 set: `100kg×5`, `100kg×5`, `100kg×3`. Query max weight `ORDER BY weight_kg DESC, performed_at ASC LIMIT 1` hòa ở cả 3 set → Postgres trả về set bất kỳ, response PR có thể báo `reps: 3` thay vì `reps: 5`, và kết quả thay đổi giữa các lần gọi / sau `VACUUM`. Tương tự cho e1rm/volume khi hai set giống nhau.
**Fix:** thêm tie-break toàn phần vào cả index và `ORDER BY` của M3 (với max weight, ưu tiên set nhiều reps hơn có ý nghĩa nghiệp vụ):
```prisma
@@index([userId, exerciseId, weightKg(sort: Desc), performedAt, reps(sort: Desc), id], map: "workout_sets_pr_weight_idx")
@@index([userId, exerciseId, volumeKg(sort: Desc), performedAt, id], map: "workout_sets_pr_volume_idx")
@@index([userId, exerciseId, e1rmKg(sort: Desc), performedAt, id], map: "workout_sets_pr_e1rm_idx")
```
```ts
orderBy: [{ weightKg: 'desc' }, { performedAt: 'asc' }, { reps: 'desc' }, { id: 'asc' }]
```

### M2. PR index không phục vụ được "period comparison" ở quy mô 50k+ — `prisma/schema.prisma:87-89`
**Rule:** Checklist D4 — Index-aware queries (equality columns trước, rồi range/sort); yêu cầu "50k+ entries per user must perform well".
**Problem:** Các index PR có thứ tự `(user_id, exercise_id, <metric> DESC, performed_at)`. Query so sánh giai đoạn `WHERE user_id=? AND exercise_id=? AND performed_at BETWEEN ? AND ? ORDER BY weight_kg DESC LIMIT 1` sẽ đi index theo thứ tự weight và **lọc** `performed_at` từng dòng; nếu các set nặng nhất nằm ngoài khoảng (case phổ biến: "tháng này so với tháng trước" khi kỷ lục all-time ở năm ngoái), planner quét gần hết set của exercise đó (50k entries × vài set = hàng trăm nghìn index entries), nhân 3 metric × 2 period cho mỗi request. Index chỉ tối ưu cho PR all-time.
**Fix:** thêm một covering index theo range thời gian, để query period dùng `MAX()` trên đúng phần dữ liệu của khoảng đó (index-only scan):
```sql
-- migration mới (Prisma chưa hỗ trợ INCLUDE → viết SQL tay)
CREATE INDEX "workout_sets_period_idx"
  ON "workout_sets" ("user_id", "exercise_id", "performed_at")
  INCLUDE ("weight_kg", "volume_kg", "e1rm_kg");
```
Rồi viết query period dạng `SELECT max(weight_kg), max(volume_kg), max(e1rm_kg) ... WHERE performed_at >= $from AND performed_at < $to` (một lần quét cho cả 3 metric), và chỉ quay lại tìm "set nào / ngày nào" bằng điều kiện `weight_kg = $max` trong khoảng đó. Kiểm chứng bằng `EXPLAIN (ANALYZE, BUFFERS)` trên seed 50k.

### M3. Lỗi Prisma/DB không được map → race khi bulk logging trả 500 — `src/common/filters/all-exceptions.filter.ts:70-95`
**Rule:** Checklist C5 — Map known DB errors; CLAUDE.md — "Throw `DomainError` subclasses with a code from `common/errors/error-codes.ts`".
**Problem:** `normalize()` chỉ biết `DomainError` và `HttpException`; mọi `Prisma.PrismaClientKnownRequestError` rơi vào nhánh 500. Kịch bản M3 thực tế: hai request bulk cùng log exercise mới "Zercher Squat" → cả hai thấy chưa tồn tại → một request dính `P2002` trên `exercises_normalized_name_key` → 500 `INTERNAL_ERROR` và toàn bộ transaction bulk bị hủy. Tương tự `P2003` (FK), `P2025` (not found), `P2024` (hết connection pool — nên là 503, không phải 500), và DB down giữa chừng. `ErrorCode.CONFLICT` / `SERVICE_UNAVAILABLE` đã có nhưng không có đường nào sinh ra chúng từ lỗi DB.
**Fix:** (1) trong repository M3, resolve exercise bằng `createMany({ data, skipDuplicates: true })` rồi `findMany({ where: { normalizedName: { in } } })` để không có race ngay từ đầu; (2) thêm nhánh map lỗi Prisma (đặt trong `src/common/helpers/` hoặc trong filter):
```ts
if (exception instanceof Prisma.PrismaClientKnownRequestError) {
  const code = PRISMA_ERROR_CODES[exception.code]; // P2002→CONFLICT, P2003→VALIDATION_ERROR, P2025→NOT_FOUND, P2024→SERVICE_UNAVAILABLE
  if (code) return { status: ERROR_HTTP_STATUS[code], code, message: PUBLIC_MESSAGES[code], details: [] };
}
if (exception instanceof Prisma.PrismaClientInitializationError) {
  return { status: 503, code: ErrorCode.SERVICE_UNAVAILABLE, message: 'Database is unavailable', details: [] };
}
```
(Không đưa `exception.message` của Prisma ra response — nó chứa tên bảng/constraint.)

## 🟡 Minor
- **m1.** `prisma/schema.prisma:66-74` — `weight Decimal(10,3)` nhưng chưa có gì giới hạn số chữ số thập phân/độ lớn đầu vào: Postgres sẽ **làm tròn âm thầm** `100.12345` → `100.123` trong khi `weight_kg` tính từ giá trị chưa làm tròn (vi phạm CLAUDE.md "Round only for presentation, never before persisting"), và `weight`/`reps` quá lớn làm tràn `volume_kg Decimal(16,6)` → lỗi numeric overflow → 500 → DTO M3 phải mirror precision DB: `@IsNumber({ maxDecimalPlaces: 3 }) @Max(…)` cho weight, `@Max(…)` cho reps, và thêm CHECK upper bound tương ứng.
- **m2.** `prisma/schema.prisma:76-79` — `user_id/exercise_id/performed_at` denormalize lên `workout_sets` chỉ "immutable" theo comment, DB không đảm bảo; một update entry (hoặc raw SQL/seed sai) làm PR báo sai ngày/user → thêm `@@unique([id, userId, exerciseId, performedAt])` trên `WorkoutEntry` và composite FK từ `workout_sets` tới nó với `ON UPDATE CASCADE`.
- **m3.** `prisma/migrations/20261014052233_init/migration.sql:6,18,30` — `id` UUID không có DB default (`@default(uuid())` sinh ở Prisma client), nên seed 50k hoặc bulk insert bằng raw SQL (`INSERT … SELECT unnest(…)`) phải tự sinh id → dùng `@default(dbgenerated("gen_random_uuid()"))`.
- **m4.** `prisma/schema.prisma:55-57` — filter history theo muscle group sẽ thành `exercise_id IN (…)` + `ORDER BY performed_at DESC, id DESC`; index thứ hai không cho thứ tự gộp qua nhiều exercise, index thứ nhất không chứa `exercise_id` → heap fetch hoặc sort toàn bộ entries của user mỗi trang → cân nhắc `@@index([userId, performedAt(sort: Desc), id(sort: Desc)])` kèm `INCLUDE (exercise_id)` (SQL tay) và đo bằng `EXPLAIN` trên seed 50k.
- **m5.** `src/common/filters/all-exceptions.filter.ts:27-33,84` — `HttpException` có status 4xx ngoài bảng (405, 415, 422, 429…) trả `code: INTERNAL_ERROR` kèm status 4xx, mâu thuẫn contract → fallback theo dải: `status < 500 ? ErrorCode.VALIDATION_ERROR (hoặc code BAD_REQUEST riêng) : INTERNAL_ERROR`.
- **m6.** `src/common/middleware/body-parser-error.middleware.ts:30-31` — chỉ map `entity.parse.failed`/`entity.too.large`; các lỗi body-parser khác (`charset.unsupported` 415, `encoding.unsupported` 415, `request.aborted` 400) là `http-errors` chứ không phải `HttpException` → filter trả 500 và log error → map theo `err.status` khi `isBodyParserError` (status < 500 → `VALIDATION_ERROR`/`MALFORMED_JSON`).
- **m7.** `src/common/errors/error-codes.ts:1,20-32` — `ERROR_HTTP_STATUS` import `HttpStatus` từ `@nestjs/common`, nên `DomainError` kéo theo Nest; code trong `modules/*/domain/` (vd. decode cursor, validate date range ở M3) không thể throw `ValidationError`/`INVALID_CURSOR` mà vẫn "framework-free" theo CLAUDE.md (ESLint chỉ chặn import trực tiếp nên sẽ không báo) → chuyển bảng code→status sang `common/filters/` để `common/errors` thuần TS.
- **m8.** `src/health/health.controller.ts:9-13` + `src/infrastructure/prisma/prisma.service.ts:45-51` — controller gọi thẳng `PrismaService` (CLAUDE.md: "Controllers: … No Prisma"), và `ping()` nuốt lỗi bằng `catch { return false }` nên health 503 không để lại log nguyên nhân → log lỗi trong `catch` (`this.logger.warn({ err }, 'DB ping failed')`); nếu muốn đúng layering, chuyển ping vào một `HealthService`/indicator.
- **m9.** `src/config/configuration.ts:7-26` — đọc lại `process.env` với cast `as string`/`as NodeEnv` và lặp lại default (`3000`, `200`, `'config/exercise-catalog.json'`) đã khai báo ở `EnvironmentVariables` → hai nguồn default sẽ lệch nhau; build `configuration` từ kết quả `validateEnv(process.env)` để dùng giá trị đã validate và đúng kiểu.
- **m10.** `test/utils/global-setup.ts:7-12`, `test/e2e/exercises.e2e-spec.ts:71-93` — DB test không được reset giữa các lần chạy (container `db-test` sống qua nhiều lần `npm run test:e2e`), cleanup không nằm trong `finally`; khi M3 thêm test history/PR (đếm số entry, kiểm PR của một `userId`), dữ liệu lần chạy trước sẽ làm test flaky (Checklist E4) → `TRUNCATE workout_sets, workout_entries` trong `globalSetup` và dùng `userId` ngẫu nhiên cho từng test (`user-${randomUUID()}`).

## ⚪ Nits
- `src/modules/units/domain/weight-unit.registry.ts` — có hàm thuần `isWeightUnit` nhưng không có `*.spec.ts` cạnh nó (CLAUDE.md: "Every pure function has a `*.spec.ts` next to it").
- `src/modules/exercises/domain/exercise-catalog.ts:40` — `item.name.trim().replace(/\s+/g, ' ')` lặp lại một phần `normalizeName`; tách `collapseWhitespace()` vào `common/utils/string.util.ts`.
- `src/modules/units/unit-converter.service.spec.ts:15-23` — pattern `try/catch` + `expect` thiếu `expect.assertions(n)`; dùng `toThrow(expect.objectContaining({ code, details }))` gọn và chắc hơn.
- `src/app.setup.ts:28-36` / `src/main.ts:11` — Swagger bật cả ở `production`; `docker-compose.yml` service `api` không có `healthcheck` dù đã có `/health`.

## 👍 Done well
- Error contract một chỗ (`AllExceptionsFilter`) với `requestId` có mặt cả khi lỗi xảy ra trong body-parser trước Nest (request-id middleware chạy đầu tiên), lỗi lạ trả 500 opaque và được test (`all-exceptions.filter.spec.ts`).
- Unit handling đúng tinh thần CLAUDE.md: registry một dòng/đơn vị, lưu cả `weight`+`unit` và `weight_kg` full precision, `present()` trả lại số gốc khi cùng đơn vị (225 lb không thành 224.99).
- Schema có CHECK constraint ở DB làm lớp phòng thủ cuối, keyset index `(user_id, performed_at DESC, id DESC)` cho history, env validation fail-fast, và `configureApp()` dùng chung cho `main.ts` và e2e nên test chạy đúng pipe/filter production.

## ❓ Questions
- "Max volume" trong spec là **mỗi set** (`reps × weight`) hay **mỗi entry/buổi tập** (tổng các set)? Schema chỉ lưu `volume_kg` theo set; nếu là theo entry thì cần cột `total_volume_kg` trên `workout_entries` + index riêng, nên chốt trước khi viết M3.
- `ErrorCode.IDEMPOTENCY_KEY_REUSED` đã được định nghĩa nhưng schema chưa có bảng lưu idempotency key — bulk logging có định hỗ trợ retry an toàn không? Nếu không, client retry sẽ nhân đôi entry và làm sai volume/PR.
- `exercises` là bảng toàn cục: nếu bulk logging tạo exercise từ tên tự do, tên do một user gõ (kể cả typo) sẽ xuất hiện cho mọi user và `GET /exercises` (`exercises.repository.ts:41-43`, `findMany` không giới hạn) sẽ phình theo — có chủ đích không? (Spec không yêu cầu auth nên `userId` là tham số; mình không coi việc thiếu auth là finding.)

---
Muốn mình sửa các mục Major (M1–M3) và các Minor liên quan tới schema (m1–m4) trước khi bắt đầu M3 không?
