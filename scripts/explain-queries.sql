-- EXPLAIN (ANALYZE, BUFFERS) for the hot queries, written exactly as the repositories issue them,
-- against the dataset from seed-large.sql (user "perf-heavy": 60,000 entries / 240,000 sets).
--
--   docker compose exec -T db psql -U everfit -d workouts < scripts/explain-queries.sql

\set ON_ERROR_STOP on
\pset pager off

SELECT id AS bench FROM exercises WHERE normalized_name = 'bench press' \gset
SELECT id AS hip FROM exercises WHERE normalized_name = 'hip thrust' \gset
SELECT array_agg(id)::text AS chest_ids FROM exercises WHERE muscle_groups @> ARRAY['chest'] \gset
-- A cursor in the middle of the user's history (page ~1500 at 20 per page).
SELECT performed_at AS mid_at, id AS mid_id
  FROM workout_entries WHERE user_id = 'perf-heavy'
 ORDER BY performed_at DESC, id DESC OFFSET 30000 LIMIT 1 \gset

\echo '=== Q1 history: first page, no filters ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.id, e.exercise_id, x.name, x.muscle_groups, e.performed_at, e.timezone
  FROM workout_entries e JOIN exercises x ON x.id = e.exercise_id
 WHERE e.user_id = 'perf-heavy'
 ORDER BY e.performed_at DESC, e.id DESC LIMIT 21;

\echo '=== Q2 history: deep page via keyset cursor (entry #30,000) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.id, e.exercise_id, x.name, x.muscle_groups, e.performed_at, e.timezone
  FROM workout_entries e JOIN exercises x ON x.id = e.exercise_id
 WHERE e.user_id = 'perf-heavy'
   AND (e.performed_at, e.id) < (:'mid_at'::timestamptz, :'mid_id'::uuid)
 ORDER BY e.performed_at DESC, e.id DESC LIMIT 21;

\echo '=== Q3 history: filter by a RARE exercise (Hip Thrust, 60 of 60,000 entries) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.id, e.exercise_id, x.name, x.muscle_groups, e.performed_at, e.timezone
  FROM workout_entries e JOIN exercises x ON x.id = e.exercise_id
 WHERE e.user_id = 'perf-heavy' AND e.exercise_id = ANY (ARRAY[:'hip']::uuid[])
 ORDER BY e.performed_at DESC, e.id DESC LIMIT 21;

\echo '=== Q4 history: filter by muscle group (chest → several exercise ids) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.id, e.exercise_id, x.name, x.muscle_groups, e.performed_at, e.timezone
  FROM workout_entries e JOIN exercises x ON x.id = e.exercise_id
 WHERE e.user_id = 'perf-heavy' AND e.exercise_id = ANY (:'chest_ids'::uuid[])
 ORDER BY e.performed_at DESC, e.id DESC LIMIT 21;

\echo '=== Q5 personal records: all-time (3 metrics, one round trip) ==='
EXPLAIN (ANALYZE, BUFFERS)
(SELECT 'weight', s.entry_id, s.weight_kg, s.performed_at FROM workout_sets s
  WHERE s.user_id = 'perf-heavy' AND s.exercise_id = :'bench'::uuid
  ORDER BY s.weight_kg DESC, s.performed_at ASC, s.id ASC LIMIT 1)
UNION ALL
(SELECT 'volume', s.entry_id, s.volume_kg, s.performed_at FROM workout_sets s
  WHERE s.user_id = 'perf-heavy' AND s.exercise_id = :'bench'::uuid
  ORDER BY s.volume_kg DESC, s.performed_at ASC, s.id ASC LIMIT 1)
UNION ALL
(SELECT 'e1rm', s.entry_id, s.e1rm_kg, s.performed_at FROM workout_sets s
  WHERE s.user_id = 'perf-heavy' AND s.exercise_id = :'bench'::uuid
  ORDER BY s.e1rm_kg DESC, s.performed_at ASC, s.id ASC LIMIT 1);

\echo '=== Q6 personal records: within one month (period comparison) ==='
EXPLAIN (ANALYZE, BUFFERS)
(SELECT 'weight', s.entry_id, s.weight_kg, s.performed_at FROM workout_sets s
  WHERE s.user_id = 'perf-heavy' AND s.exercise_id = :'bench'::uuid
    AND s.performed_at >= '2025-10-01T00:00:00Z'::timestamptz
    AND s.performed_at <  '2025-11-01T00:00:00Z'::timestamptz
  ORDER BY s.weight_kg DESC, s.performed_at ASC, s.id ASC LIMIT 1)
UNION ALL
(SELECT 'volume', s.entry_id, s.volume_kg, s.performed_at FROM workout_sets s
  WHERE s.user_id = 'perf-heavy' AND s.exercise_id = :'bench'::uuid
    AND s.performed_at >= '2025-10-01T00:00:00Z'::timestamptz
    AND s.performed_at <  '2025-11-01T00:00:00Z'::timestamptz
  ORDER BY s.volume_kg DESC, s.performed_at ASC, s.id ASC LIMIT 1)
UNION ALL
(SELECT 'e1rm', s.entry_id, s.e1rm_kg, s.performed_at FROM workout_sets s
  WHERE s.user_id = 'perf-heavy' AND s.exercise_id = :'bench'::uuid
    AND s.performed_at >= '2025-10-01T00:00:00Z'::timestamptz
    AND s.performed_at <  '2025-11-01T00:00:00Z'::timestamptz
  ORDER BY s.e1rm_kg DESC, s.performed_at ASC, s.id ASC LIMIT 1);
