-- Performance dataset: one heavy user with 60,000 entries (~240,000 sets) over ~2 years,
-- plus 4 other users with 15,000 entries each, so indexes are exercised with realistic
-- selectivity. Idempotent: re-running replaces the seeded users' data.
--
--   docker compose exec -T db psql -U everfit -d workouts < scripts/seed-large.sql
--
-- Exercise mix for the heavy user: 10 common exercises in rotation, plus "Hip Thrust" on every
-- 1000th entry (60 entries) to test filtering by a rare exercise.

\set ON_ERROR_STOP on
\timing on

BEGIN;

DELETE FROM workout_entries WHERE user_id LIKE 'perf-%';

CREATE TEMP TABLE seed_exercises ON COMMIT DROP AS
SELECT id, (row_number() OVER (ORDER BY normalized_name) - 1)::int AS k
  FROM exercises
 WHERE normalized_name = ANY (ARRAY[
   'bench press', 'back squat', 'deadlift', 'overhead press', 'barbell row',
   'pull up', 'lat pulldown', 'leg press', 'romanian deadlift', 'incline bench press'
 ]);

-- Heavy user: one entry every 17 minutes from 2024-10-14 → ~2 years.
INSERT INTO workout_entries (id, user_id, exercise_id, performed_at, timezone)
SELECT gen_random_uuid(),
       'perf-heavy',
       CASE WHEN g % 1000 = 0
            THEN (SELECT id FROM exercises WHERE normalized_name = 'hip thrust')
            ELSE (SELECT id FROM seed_exercises WHERE k = g % 10)
       END,
       timestamptz '2024-10-14 06:00:00+00' + g * interval '17 minutes',
       'Asia/Ho_Chi_Minh'
  FROM generate_series(1, 60000) AS g;

-- Background users.
INSERT INTO workout_entries (id, user_id, exercise_id, performed_at, timezone)
SELECT gen_random_uuid(),
       'perf-other-' || u,
       (SELECT id FROM seed_exercises WHERE k = (g + u) % 10),
       timestamptz '2024-10-14 06:00:00+00' + g * interval '47 minutes',
       NULL
  FROM generate_series(1, 4) AS u, generate_series(1, 15000) AS g;

-- 4 sets per entry with deterministic pseudo-random reps (3-10) and weights (40-140 kg).
INSERT INTO workout_sets (entry_id, set_index, reps, weight, unit, weight_kg, volume_kg, e1rm_kg,
                          user_id, exercise_id, performed_at)
SELECT e.id, s, v.reps, v.w, 'kg', v.w, v.w * v.reps, v.w * (1 + v.reps / 30.0),
       e.user_id, e.exercise_id, e.performed_at
  FROM workout_entries e
 CROSS JOIN generate_series(0, 3) AS s
 CROSS JOIN LATERAL (
   SELECT 3 + abs(hashtext(e.id::text || s::text)) % 8 AS reps,
          round((40 + abs(hashtext(e.id::text)) % 100 + s * 2.5)::numeric, 1) AS w
 ) AS v
 WHERE e.user_id LIKE 'perf-%';

COMMIT;

ANALYZE exercises;
ANALYZE workout_entries;
ANALYZE workout_sets;

SELECT user_id, count(*) AS entries
  FROM workout_entries WHERE user_id LIKE 'perf-%' GROUP BY user_id ORDER BY user_id;
SELECT count(*) AS perf_sets FROM workout_sets WHERE user_id LIKE 'perf-%';
