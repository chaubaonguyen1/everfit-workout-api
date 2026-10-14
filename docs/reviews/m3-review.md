# Code review: M3 — bulk workout logging (`git diff d427f78..HEAD`, 5 commits, 37 files)

**Verdict:** 🟡 Approve with comments
Luồng ghi chính đúng: validate thuần trước transaction, claim idempotency key + insert entries/sets + lưu response trong **một** transaction, resolve exercise race-safe bằng `ON CONFLICT DO NOTHING`, lỗi Prisma đã được map. Không có lỗi Critical. Rủi ro lớn nhất là **chuyển wall-clock → UTC sai trong khoảng DST gap**: với một số time zone, ngày `YYYY-MM-DD` bị lưu sang **ngày hôm trước**, và test hiện tại không bắt được.

| 🔴 Critical | 🟠 Major | 🟡 Minor | ⚪ Nit |
|---|---|---|---|
| 0 | 1 | 8 | 4 |

## 🟠 Major

### M1. Wall time nằm trong DST gap bị lùi về trước gap → date-only có thể rơi sang ngày hôm trước — `src/common/utils/date.util.ts:79-84`
**Rule:** Checklist D9 — Time (ranh giới ngày phụ thuộc time zone); CLAUDE.md — "Accept ISO-8601 with offset, or date + IANA timezone"; docstring tự cam kết "times on either side of a DST change resolve to the correct offset".
**Problem:** `zonedWallTimeToUtc` lấy offset ở `wallMs`, rồi chỉnh lại một lần. Khi wall time **không tồn tại** (gap) ở zone có offset âm, kết quả bị đẩy về **trước** gap thay vì sau:
- `parseInstant('2026-09-06', 'America/Santiago')` (Chile đổi giờ lúc 24:00 → 01:00): offset tại `00:00Z` là −4 → guess `04:00Z`; offset tại `04:00Z` là −3 → trả `03:00Z` = **2026-09-05 23:00** giờ Santiago. Entry log cho ngày 6/9 được lưu là ngày 5/9 → history/PR/period comparison theo ngày local sẽ sai. Tương tự `Atlantic/Azores` (29/3/2026), `America/Havana`.
- `parseInstant('2026-03-08T02:30', 'America/New_York')` trả `06:30Z` = 01:30 EST (lùi 1h), trong khi quy ước chuẩn (Temporal/java.time "compatible") là 03:30 EDT.
Test `date.util.spec.ts:36-41` chỉ kiểm thời điểm **sau** gap (03:30), không có case gap/overlap nào, nên bug lọt qua.
**Fix:** xét offset trước và sau mốc chuyển, chọn ứng viên có wall time khớp; nếu không có (gap) thì dịch **tới** theo offset trước khi chuyển; overlap thì lấy lần xuất hiện sớm hơn:
```ts
const DAY_MS = 86_400_000;

export function zonedWallTimeToUtc(wall: WallTime, timeZone: string): Date {
  const wallMs = wallTimeAsUtcMs(wall);
  const before = timeZoneOffsetMs(new Date(wallMs - DAY_MS), timeZone);
  const after = timeZoneOffsetMs(new Date(wallMs + DAY_MS), timeZone);
  const matches = [wallMs - before, wallMs - after]
    .filter((ms) => wallTimeAsUtcMs(toWallTime(new Date(ms), timeZone)) === wallMs)
    .sort((a, b) => a - b);
  // Overlap → earliest occurrence; gap → shift forward by the gap length.
  return new Date(matches[0] ?? wallMs - before);
}
```
Kèm test table-driven: gap (`America/New_York 2026-03-08T02:30` → `07:30Z`), midnight gap (`America/Santiago 2026-09-06` → `04:00Z`, `Atlantic/Azores 2026-03-29` → `01:00Z`), overlap (`America/New_York 2026-11-01T01:30` → `05:30Z`), zone offset dương (`Africa/Cairo 2026-04-24` → `22:00Z` ngày 23).

## 🟡 Minor
- **m1.** `src/common/utils/string.util.ts:5-7` + `src/modules/workouts/dto/create-workouts.dto.ts:57-61` — `@Length(1, 100)` kiểm tên **trước** `normalize('NFKC')` + `toLowerCase()`, mà hai phép này có thể làm chuỗi dài ra (`'İ'.toLowerCase()` = 2 ký tự, `'ﷺ'` NFKC = 18 ký tự) → `normalized_name VARCHAR(100)` tràn → Prisma `P2000` không có trong `mapPrismaError` → 500 từ input của client → validate độ dài trên `normalizeName(name)` trong `prepareEntries` (đẩy vào `problems`), và map `P2000` → `VALIDATION_ERROR`.
- **m2.** `src/common/filters/all-exceptions.filter.ts:46-51,66` — lỗi Prisma được map sang 4xx (`P2002`→409, `P2003`→400, `P2025`→404) thì **không được log** (filter chỉ log khi status ≥ 500); ở luồng hiện tại `P2003`/`P2002` chỉ có thể do bug, nên bug sẽ hiện ra như lỗi của client và không để lại dấu vết → log `warn` với `{ prismaCode: exception.code, meta: exception.meta }` khi `domainError` đến từ `mapPrismaError`.
- **m3.** `src/modules/workouts/dto/create-workouts.dto.ts:77-79`, `src/common/utils/date.util.ts:25-43`, `src/modules/workouts/workouts.service.ts:55` — `@IsTimeZone()` chấp nhận mọi biến thể hoa/thường (`asia/ho_chi_minh`, `ASIA/HO_CHI_MINH`) và chuỗi đó được lưu nguyên vào `workout_entries.timezone` (dữ liệu không đồng nhất) và làm key cho cache `formatters` (map không giới hạn, mỗi biến thể một `Intl.DateTimeFormat`) → canonicalize một lần ở biên: `new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone` (qua `@Transform` hoặc trong `prepareEntries`) rồi dùng giá trị đó cho cả cache và cột DB.
- **m4.** `src/modules/workouts/workouts.service.ts:55`, `src/modules/workouts/workouts.repository.ts:24,42` — khi client gửi `date` có offset (`...T05:00:00+07:00`) mà không gửi `timezone`, entry lưu `timezone = null` và offset bị bỏ → mất "ngày local" của buổi tập (05:00 +07 = 22:00Z hôm trước theo UTC), các thống kê theo ngày/tuần ở M4+ sẽ xếp sai ngày; ngược lại khi gửi cả hai mà mâu thuẫn, `timezone` lưu không khớp offset thực tế → hoặc lưu thêm `utc_offset_minutes` theo entry, hoặc tài liệu hoá rõ "ngày local luôn tính theo `timezone`, mặc định UTC" (xem Questions).
- **m5.** `prisma/schema.prisma:74-76`, `src/modules/idempotency/idempotency.repository.ts:17-23` — schema comment nói có "periodic TTL cleanup" nhưng không có job/cron/script nào xoá `idempotency_keys` (grep không thấy), nên bảng tăng vô hạn (mỗi key lưu tới vài trăm KB `response_body` với batch 100×50) và key cũ được replay mãi; key cũng không gắn với endpoint, nên khi thêm endpoint idempotent thứ hai, cùng key sẽ va nhau → thêm cột `scope` (vd. `'POST /workouts'`) vào PK hoặc vào hash, và hoặc implement cleanup (`DELETE … WHERE created_at < now() - interval '24 hours'` theo lịch) hoặc bỏ câu hứa trong comment và ghi vào README.
- **m6.** `test/e2e/workouts.e2e-spec.ts:233-244` — test "sent concurrently" pass cả khi 5 request bị xử lý tuần tự (chỉ là replay bình thường), nên không chứng minh nhánh "request thứ hai **chờ** row chưa commit rồi replay"; cũng không assert có đúng 4 response mang `Idempotent-Replayed: true` và body giống hệt nhau → thêm assert `responses.filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(4)` + `toEqual` body, và một test tất định: mở `prisma.$transaction` giữ claim key (insert row rồi chờ một promise), bắn request, xác nhận request chưa trả về cho tới khi transaction đó commit/rollback.
- **m7.** `test/e2e/workouts.e2e-spec.ts:75-80` — test happy path nói "normalizing units" nhưng chỉ kiểm DB cho set 140 kg; không kiểm set lb lưu `weight = 225`, `unit = 'lb'` và `weight_kg` **full precision** (`102.058283`, không phải `102.06`) — đúng yêu cầu spec "store normalized kg alongside the original" và CLAUDE.md "never round before persisting" → thêm `expect(lbSet).toMatchObject({ unit: 'lb' })`, `expect(Number(lbSet.weight)).toBe(225)`, `expect(Number(lbSet.weightKg)).toBeCloseTo(102.058283, 6)`.
- **m8.** `src/infrastructure/prisma/transaction-runner.ts:26-36` — logic retry `P2034` không có test nào, và request trùng key phải chờ transaction đầu (tính vào `timeout: 10_000` của chính nó): nếu transaction đầu chạy lâu rồi rollback, transaction sau có thể hết hạn → `P2028` không được map → 500 → thêm unit test cho runner (mock `$transaction` ném `P2034` n lần) và map `P2028` → `SERVICE_UNAVAILABLE`/`CONFLICT` "please retry".

## ⚪ Nits
- `src/modules/exercises/exercises.repository.ts:55` — tham số tên `db` trong khi mọi repository khác dùng `tx: Tx`.
- `src/modules/idempotency/idempotency.service.ts:47` — `existing.responseBody as T` là cast không kiểm tra trên dữ liệu từ DB; chấp nhận được nhưng nên ghi chú giả định (response luôn do chính endpoint này ghi).
- `src/modules/workouts/workouts.service.ts:37` — `new Date()` trực tiếp; inject một `Clock` để test giới hạn "24h in the future" ở mức service/e2e mà không phụ thuộc giờ thật (Checklist E4).
- `test/e2e/workouts.e2e-spec.ts:257` — "creates a brand-new exercise only once" luôn đúng nhờ unique constraint; điều test thực sự chứng minh là "không có 409/500 khi race" → đổi tên cho đúng.

## 👍 Done well
- Idempotency claim nằm trong cùng transaction với các insert: `INSERT … ON CONFLICT DO NOTHING` trên PK `(user_id, key)` làm request trùng **chờ** row chưa commit, rồi (READ COMMITTED, snapshot mới cho mỗi statement) đọc được response đã commit hoặc tự claim nếu bên kia rollback — không có cửa sổ "row có `response_body = NULL`" lộ ra ngoài. Retry `P2034` chạy lại toàn bộ unit of work, nên claim cũng được rollback/claim lại đúng.
- `resolveIds` dùng `createMany({ skipDuplicates })` + `findMany` với danh sách đã sort → giải quyết M3 của review trước, không race, thứ tự lock ổn định; batch insert chỉ 2 statement bất kể kích thước; validation thuần (`prepareEntries`) gom mọi lỗi theo path và chạy trước khi mở transaction.
- DTO bound khớp precision DB (`maxDecimalPlaces: 3`, `@Max` cho weight/reps, `ArrayMaxSize` cho entries/sets) — đã xử lý m1 của review trước; `mapPrismaError` không bao giờ forward message của Prisma.

## ❓ Questions
- Spec yêu cầu "document timezone strategy" nhưng README chưa có trong repo: chiến lược dự kiến là "date-only = 00:00 local theo `timezone` (mặc định UTC), offset trong `date` luôn thắng `timezone`" đúng không? Cần ghi rõ, và quyết định cho m4.
- Replay trả lại `201` + header `Idempotent-Replayed: true` (kiểu Stripe) là có chủ đích, hay muốn `200` để client phân biệt?
- Câu hỏi về bảng `exercises` toàn cục ở review trước giờ đã thành hiện thực: bất kỳ `userId` nào log tên tự do (kể cả typo, hoặc chữ hoa/thường lần đầu như `bench PRESS`) sẽ tạo exercise và đặt display name cho **mọi** user — có chấp nhận cho phạm vi take-home không?

---
Muốn mình sửa M1 (kèm test DST) và các Minor m1–m3 trước không?
