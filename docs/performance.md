# Performance at 50k+ entries per user

Measured on 2026-10-14 against the Docker Compose stack (Postgres 16, default settings, laptop).

## Dataset — `scripts/seed-large.sql`

| User | Entries | Sets |
|---|---|---|
| `perf-heavy` | 60,000 (one every 17 min over ~2 years) | 240,000 |
| `perf-other-1..4` | 15,000 each | 60,000 each |
| **Total** | **120,000** | **480,000** |

`perf-heavy` rotates 10 common exercises; *Hip Thrust* appears on every 1000th entry (60 entries)
to exercise the "rare exercise" filter path.

```bash
docker compose exec -T db psql -U everfit -d workouts < scripts/seed-large.sql
docker compose exec -T db psql -U everfit -d workouts < scripts/explain-queries.sql
```

## Database: `EXPLAIN (ANALYZE, BUFFERS)` — queries exactly as the repositories issue them

| Query (user with 60,000 entries) | Plan | Execution |
|---|---|---|
| History, first page | Index scan `(user_id, performed_at DESC, id DESC)`, stops after 21 rows | 0.07 ms |
| History, page at entry #30,000 (keyset cursor) | Same index, seeks directly to the cursor | 0.07 ms |
| History, rare exercise (60 matches) | Index-only scan `(user_id, exercise_id, performed_at, id)` + top-N sort | 0.21 ms |
| History, 2 exercises never logged (`muscleGroup=abs`) | Same index with `exercise_id = ANY(…)` — 0 rows read | 0.12 ms |
| History, 3 exercises (~12k matches), deep page | Planner switches to the time-ordered index + filter | 0.35 ms |
| PR all-time, 3 metrics in one `UNION ALL` | One PR index per metric, 1 index entry each | 0.09 ms |
| PR within one month (period comparison) | Same PR indexes, bounded by time | 0.08 ms |

Keyset pagination is why deep pages cost the same as page 1; with `OFFSET 30000` Postgres would
read and discard 30,000 rows.

## HTTP: end-to-end latency (median of 5, warm, includes JSON serialization)

| Endpoint | Latency |
|---|---|
| `GET /workouts?limit=20` (20 entries + their sets) | 7.7 ms |
| `GET /workouts?limit=20&cursor=…` (next page) | 8.1 ms |
| `GET /workouts?exercise=hip` (rare exercise) | 7.7 ms |
| `GET /workouts?muscleGroup=chest&unit=lb` | 9.2 ms |
| `GET /workouts?exercise=e` (broad search term) | 7.5 ms |
| `GET /workouts?from=2025-10-01&to=2025-10-31&limit=100` | 13.3 ms |
| `GET /personal-records?exercise=Bench Press` | 5.0 ms |
| `GET /personal-records/compare?…&period=month` | 8.5 ms |

## Design choices that make this hold

- **Metrics computed at write time** (`weight_kg`, `volume_kg`, `e1rm_kg`) → PRs are
  `ORDER BY metric DESC LIMIT 1` on a matching index, never an aggregate over all sets.
- **Denormalized `user_id`/`exercise_id`/`performed_at` on `workout_sets`** → PR queries never join.
- **Keyset pagination with a row-value comparison** `(performed_at, id) < (…)` matching the
  index order exactly.
- **Exercise filters resolve to ids first**, restricted to exercises the user has logged, so a
  broad term can't expand into thousands of other users' exercise names.

## Investigated and not changed

The M4 review predicted that filtering by several exercise ids would sort all matching rows on
every page and proposed a per-exercise `LATERAL` merge query. Measured: the planner already picks
the `(user_id, exercise_id, …)` index when matches are few and the time-ordered index when they
are many (0.12–0.35 ms in the worst cases above). The simpler query was kept; the id list was
bounded instead (see last bullet above).
