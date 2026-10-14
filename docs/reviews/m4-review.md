# Code review: M4 — workout history (`git diff 8a0c210..620fc80`, 3 commits, 17 files)

**Verdict:** 🟡 Approve with comments
Keyset pagination đúng: `ORDER BY performed_at DESC, id DESC` khớp với điều kiện `(performed_at, id) < (…)`, fetch `limit + 1`, cursor được validate chặt. SQL đều tham số hoá và cast tường minh, đơn vị trả về đúng. Không có lỗi Critical. Rủi ro lớn nhất là **hiệu năng khi filter theo exercise/muscle group** ở quy mô 50k+ entry: danh sách `exercise_id` không bị giới hạn, và không index nào vừa lọc được theo nó vừa trả đúng thứ tự `performed_at DESC`.

| 🔴 Critical | 🟠 Major | 🟡 Minor | ⚪ Nit |
|---|---|---|---|
| 0 | 1 | 5 | 3 |

## 🟠 Major

### M1. Filter `exercise`/`muscleGroup` có thể quét toàn bộ entry của user ở mỗi trang — `src/modules/workouts/workouts.service.ts:41-47`, `src/modules/workouts/workouts.repository.ts:60-62`, `src/modules/exercises/exercises.repository.ts:77-90`
**Rule:** Checklist D (query không bị giới hạn, phải được index phục vụ); spec yêu cầu "must perform well with 50,000+ entries per user". Review M0–M2 m4 đã cảnh báo về index; M4 hiện thực đúng kịch bản đó và còn thêm một vấn đề mới là danh sách id không bị giới hạn.
**Problem:**
- `findIdsMatching` tìm trên bảng `exercises` **toàn cục**: bảng này do mọi user tạo ra bằng tên tự do (đã nêu ở Questions review M3), và câu query không có `LIMIT`. Với `?exercise=e` hoặc `?muscleGroup=chest`, danh sách id có thể dài hàng trăm đến hàng nghìn phần tử, phần lớn là exercise mà user này chưa từng tập. Toàn bộ danh sách đó được truyền vào `e.exercise_id = ANY($ids::uuid[])`.
- Postgres không có index nào trả được thứ tự `performed_at DESC, id DESC` khi có điều kiện `exercise_id = ANY(...)` gồm nhiều giá trị:
  - Index `(user_id, exercise_id, performed_at DESC, id DESC)` sắp theo `exercise_id` trước. Planner phải đọc **mọi** entry khớp của tất cả id rồi sort, và việc này lặp lại ở mỗi trang.
  - Index `(user_id, performed_at DESC, id DESC)` không chứa `exercise_id`. Plain index scan phải fetch heap cho từng dòng mới lọc được. Với exercise hiếm (vài chục entry trong 50k), mỗi trang đi qua gần như toàn bộ 50k dòng heap. Thêm `INCLUDE (exercise_id)` như gợi ý ở m4 cũng không giải quyết được, vì filter chỉ chạy trên index tuple trong index-only scan.
- Chưa có seed 50k hay `EXPLAIN` nào chứng minh comment "single index-ordered scan of the user's rows" ở `workouts.service.ts:31-35`.
**Fix:** đọc từng exercise theo đúng thứ tự của index thứ hai rồi merge kết quả. Chi phí khi đó tối đa là `|ids| × take` dòng index, bất kể user có bao nhiêu entry. Đồng thời giới hạn `|ids|` (ví dụ chỉ lấy exercise mà user từng log, hoặc chặn ở N id, vượt quá thì quay về nhánh scan index thứ nhất):
```ts
// workouts.repository.ts — nhánh có exerciseIds
const rows = await this.prisma.$queryRaw<HistoryEntryRow[]>`
  SELECT p.id, p.exercise_id AS "exerciseId", x.name AS "exerciseName",
         x.muscle_groups AS "muscleGroups", p.performed_at AS "performedAt", p.timezone
    FROM unnest(${[...query.exerciseIds]}::uuid[]) AS f(exercise_id)
    CROSS JOIN LATERAL (
      SELECT e.id, e.exercise_id, e.performed_at, e.timezone
        FROM workout_entries e
       WHERE e.user_id = ${userId} AND e.exercise_id = f.exercise_id
         AND ${Prisma.join(rangeAndCursorConditions, ' AND ')}
       ORDER BY e.performed_at DESC, e.id DESC
       LIMIT ${query.take}
    ) p
    JOIN exercises x ON x.id = p.exercise_id
   ORDER BY p.performed_at DESC, p.id DESC
   LIMIT ${query.take}`;
```
Kèm một perf test hoặc script seed 50k entry, và ghi lại `EXPLAIN (ANALYZE, BUFFERS)` cho 3 case: không filter, 1 exercise hiếm, muscle group rộng.

## 🟡 Minor
- **m1.** `test/e2e/workout-history.e2e-spec.ts:109-121`: test "interprets date ranges in the requested time zone" vẫn pass nếu `timezone` bị bỏ qua hoàn toàn. `Lat Pulldown` lúc `16:30Z` nằm trong ngày 12/10 theo cả UTC lẫn Ho Chi Minh, còn case `to=2026-10-11` (UTC) thì rỗng ở cả hai zone. Vì vậy test không chứng minh được rằng `timezone` thực sự được truyền từ DTO xuống domain, và comment "…and also on Oct 12 in UTC" cũng không được assert. → Thêm một entry rơi vào hai ngày khác nhau tuỳ zone, ví dụ `2026-10-12T18:00:00Z` (ngày 13/10 01:00 ở HCM). Assert entry đó có trong `from=to=2026-10-12` khi không có `timezone` và **không** có khi `timezone=Asia/Ho_Chi_Minh`.
- **m2.** `src/common/utils/cursor.util.ts:33-34`, `src/common/utils/date.util.ts:141-146`: một số instant qua được validate của JS nhưng Postgres không parse được, nên DB trả lỗi `P2010` (không có trong `mapPrismaError`) và client nhận 500 thay vì 400. Cụ thể, cursor tự chế `{"p":"0000-01-01T00:00:00.000Z",…}` vượt qua kiểm tra canonical, nhưng Postgres báo year 0 "out of range". `to=9999-12-31` (UTC) sinh ra `+010000-01-01T00:00:00.000Z` (định dạng extended year của `toISOString`), nhiều khả năng cũng bị Postgres từ chối (chưa chạy để xác nhận). → Trong `decodeCursor` và `parseRangeEnd`/`parseInstant`, chặn năm ngoài khoảng `1..9999` (kết quả `> 9999-12-31T23:59:59.999Z` thì kẹp lại hoặc báo lỗi), và thêm test cho hai trường hợp này.
- **m3.** `src/modules/workouts/dto/workout-history.query.ts:18-20` và `src/modules/workouts/domain/history-filters.ts:67`: hai nơi quy định hai hành vi khác nhau cho cùng một input. DTO `@Transform(trim)` + `@Length(1, 100)` biến `?exercise=` và `?exercise=%20%20` thành 400, trong khi domain (kèm test "ignores a blank exercise term") lại coi chuỗi rỗng là "không filter". Ở mức HTTP, nhánh của domain không bao giờ chạy tới. → Chọn một hành vi: hoặc bỏ `@Length(1, …)` thay bằng `@MaxLength(100)` để chuỗi rỗng được bỏ qua, hoặc xoá nhánh `term || undefined` và test tương ứng.
- **m4.** `src/modules/workouts/domain/history-filters.ts:42` + `src/common/utils/cursor.util.ts`: cursor không gắn với bộ filter đã tạo ra nó. Client đổi `exercise`/`from`/`to` giữa các trang mà vẫn gửi cursor cũ thì sẽ nhận một trang "giữa chừng" mà không có lỗi nào. Ngoài ra message "invalid or **expired**" không đúng, vì cursor không bao giờ hết hạn. → Nhúng hash ngắn của filter đã normalize (`exerciseTerm|muscleGroup|from|to`) vào payload (`f`), khi lệch thì trả `INVALID_CURSOR`. Bỏ chữ "expired".
- **m5.** `src/modules/workouts/workouts.mapper.ts:48-115`, `src/modules/workouts/workouts.service.ts:36-60`: logic `hasMore`/`nextCursor`/chọn đơn vị và nhánh short-circuit khi `exerciseIds.length === 0` không có unit test. E2E cũng không phủ (a) phân trang kết hợp filter (cursor + `exerciseIds`), (b) biên `limit` bằng đúng số dòng (phải ra `hasMore: false`, `nextCursor: null`), (c) `unit=kg` cho set log bằng kg trong khi `volume`/`estimatedOneRepMax` lấy từ cột kg. → Thêm `workouts.mapper.spec.ts` (thuần, chỉ cần stub `UnitConverterService`) và một case e2e phân trang với `muscleGroup`.

## ⚪ Nits
- `src/modules/workouts/workouts.mapper.ts:108-114` + `src/modules/workouts/domain/set-metrics.ts:1-5,14,24`: `setVolume`/`epleyOneRepMax` được gọi với giá trị **lb** trong khi tham số tên `weightKg` và docstring ghi "All inputs/outputs are in kilograms". Công thức tuyến tính nên kết quả vẫn đúng, nhưng tên gây hiểu nhầm → đổi tên tham số thành `weight` và ghi chú rằng công thức không phụ thuộc đơn vị.
- `src/modules/workouts/domain/history-filters.ts:42`: cursor hỏng làm request fail ngay, trước khi gom lỗi `from`/`to`/`muscleGroup`, nên client sửa từng lỗi một → có thể đẩy lỗi cursor vào `problems` (nhưng giữ code `INVALID_CURSOR` khi đó là lỗi duy nhất).
- `src/modules/exercises/exercises.repository.ts:75`: comment "the trigram index serves the substring match" chỉ đúng khi term dài ≥ 3 ký tự. Với `be`, GIN trigram không có trigram nào để lọc → ghi rõ trong comment hoặc yêu cầu `@MinLength(2/3)`.

## 👍 Done well
- Keyset đúng chuẩn: row-value comparison `(performed_at, id) < ($ts::timestamptz, $id::uuid)` cùng chiều với `ORDER BY … DESC, … DESC` và index `(user_id, performed_at DESC, id DESC)`. Cursor giữ đủ millisecond khớp `timestamptz(3)`. Fetch `limit + 1` để biết `hasMore` mà không cần `COUNT`. E2E "share a timestamp" đặt ranh giới trang **giữa** ba entry trùng `performed_at`, nên thực sự chứng minh được tie-break.
- `decodeCursor` phòng thủ tốt: giới hạn độ dài, kiểm kiểu, regex UUID, bắt buộc ISO canonical. Mọi giá trị vào SQL đều là tham số `Prisma.sql` với cast tường minh (`::uuid[]`, `::timestamptz`). `escapeLike` cùng test `%` chứng minh wildcard được hiểu theo nghĩa đen.
- Trình bày đơn vị: khi đơn vị yêu cầu trùng đơn vị đã log thì weight/volume/1RM tính từ giá trị gốc (225 lb vẫn là 225, volume 1125), còn lại thì tính từ cột kg full-precision và chỉ làm tròn khi trình bày. Range `[from, to)` với `to` dạng date-only được hiểu là bao trọn ngày local. Kết quả rỗng trả 200 kèm `message` đúng như CLAUDE.md quy định.

## ❓ Questions
- Đã đo `EXPLAIN ANALYZE` trên seed 50k entry/user chưa (đặc biệt `muscleGroup=chest` và một exercise hiếm)? README có dự định nêu con số không?
- `findIdsMatching` tìm trên tất cả exercise của mọi user. Có muốn giới hạn vào exercise mà user này đã log không (vừa đúng ngữ nghĩa vừa thu nhỏ danh sách id ở M1)?
- `to` dạng date-time là **exclusive** (`to=…T23:59:59` loại đúng giây đó) trong khi `to` dạng date là inclusive. Đây là chủ đích và sẽ được ghi trong README/Swagger chứ? Hiện chỉ có `description` của Swagger nói điều này.

---
Muốn mình sửa M1 (kèm script seed 50k + `EXPLAIN`) và m1–m2 trước không?
