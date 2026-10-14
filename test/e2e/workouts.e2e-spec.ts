import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { createTestApp } from '../utils/test-app';
import { newUserId, uniqueExerciseName } from '../utils/test-data';

describe('POST /api/v1/users/:userId/workouts (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const post = (userId: string, body: object, idempotencyKey?: string) => {
    const req = request(app.getHttpServer()).post(`/api/v1/users/${userId}/workouts`).send(body);
    return idempotencyKey ? req.set('Idempotency-Key', idempotencyKey) : req;
  };

  const benchEntry = (overrides: object = {}) => ({
    date: '2026-10-01T07:30:00+07:00',
    exerciseName: 'Bench Press',
    sets: [{ reps: 5, weight: 100, unit: 'kg' }],
    ...overrides,
  });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('happy path', () => {
    it('logs several exercises in one request, normalizing units and resolving dates to UTC', async () => {
      const userId = newUserId();

      const res = await post(userId, {
        timezone: 'Asia/Ho_Chi_Minh',
        entries: [
          benchEntry({
            sets: [
              { reps: 5, weight: 100, unit: 'kg' },
              { reps: 3, weight: 225, unit: 'lb' },
            ],
          }),
          {
            date: '2026-10-02',
            exerciseName: '  back   squat ',
            sets: [{ reps: 5, weight: 140, unit: 'kg' }],
          },
        ],
      }).expect(201);

      expect(res.body.data).toHaveLength(2);
      const [bench, squat] = res.body.data;
      expect(bench).toMatchObject({
        exerciseName: 'Bench Press',
        performedAt: '2026-10-01T00:30:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      });
      expect(bench.sets[1]).toEqual({
        setIndex: 1,
        reps: 3,
        weight: 225,
        unit: 'lb',
        weightKg: 102.06,
        volumeKg: 306.17,
        estimatedOneRepMaxKg: 112.26,
      });
      // Resolved to the catalog exercise despite different spacing/casing.
      expect(squat).toMatchObject({
        exerciseName: 'Back Squat',
        performedAt: '2026-10-01T17:00:00.000Z',
      });

      const stored = await prisma.workoutSet.findMany({
        where: { userId },
        orderBy: { weightKg: 'desc' },
      });
      expect(stored).toHaveLength(3);
      expect(Number(stored[0].weightKg)).toBeCloseTo(140, 6);
    });

    it('creates exercises that are not in the catalog', async () => {
      const name = uniqueExerciseName('Zercher Squat');

      const res = await post(newUserId(), { entries: [benchEntry({ exerciseName: name })] }).expect(
        201,
      );

      expect(res.body.data[0].exerciseName).toBe(name);
      const exercise = await prisma.exercise.findUniqueOrThrow({
        where: { id: res.body.data[0].exerciseId },
      });
      expect(exercise.muscleGroups).toEqual([]);
    });
  });

  describe('validation (structured 400s, nothing persisted)', () => {
    const cases: [string, object, string][] = [
      ['null date', { entries: [benchEntry({ date: null })] }, 'entries[0].date'],
      [
        'negative weight',
        { entries: [benchEntry({ sets: [{ reps: 5, weight: -1, unit: 'kg' }] })] },
        'entries[0].sets[0].weight',
      ],
      [
        'zero reps',
        { entries: [benchEntry({ sets: [{ reps: 0, weight: 100, unit: 'kg' }] })] },
        'entries[0].sets[0].reps',
      ],
      [
        'fractional reps',
        { entries: [benchEntry({ sets: [{ reps: 2.5, weight: 100, unit: 'kg' }] })] },
        'entries[0].sets[0].reps',
      ],
      ['empty sets', { entries: [benchEntry({ sets: [] })] }, 'entries[0].sets'],
      [
        'unsupported unit',
        { entries: [benchEntry({ sets: [{ reps: 5, weight: 100, unit: 'stone' }] })] },
        'entries[0].sets[0].unit',
      ],
      [
        'too many decimals',
        { entries: [benchEntry({ sets: [{ reps: 5, weight: 100.1234, unit: 'kg' }] })] },
        'entries[0].sets[0].weight',
      ],
      ['empty entries', { entries: [] }, 'entries'],
      ['unknown field', { entries: [benchEntry({ weigth: 100 })] }, 'entries[0].weigth'],
      ['invalid time zone', { timezone: 'Mars/Base', entries: [benchEntry()] }, 'timezone'],
      ['impossible date', { entries: [benchEntry({ date: '2026-02-30' })] }, 'entries[0].date'],
      ['far-future date', { entries: [benchEntry({ date: '2099-01-01' })] }, 'entries[0].date'],
    ];

    it.each(cases)('%s → 400 VALIDATION_ERROR on %s', async (_label, body, field) => {
      const userId = newUserId();

      const res = await post(userId, body).expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
      expect(await prisma.workoutEntry.count({ where: { userId } })).toBe(0);
    });

    it('lists supported units in the unit error', async () => {
      const res = await post(newUserId(), {
        entries: [benchEntry({ sets: [{ reps: 5, weight: 100, unit: 'stone' }] })],
      }).expect(400);

      expect(res.body.error.details[0].issue).toBe('unit must be one of: kg, lb');
    });

    it('rejects more than 100 entries per request', async () => {
      const entries = Array.from({ length: 101 }, () => benchEntry());

      const res = await post(newUserId(), { entries }).expect(400);

      expect(res.body.error.details[0]).toMatchObject({ field: 'entries' });
    });

    it('rejects an invalid userId', async () => {
      const res = await post('bad%20user', { entries: [benchEntry()] }).expect(400);

      expect(res.body.error.details[0].field).toBe('userId');
    });

    it('is all-or-nothing: one bad entry rejects the whole batch', async () => {
      const userId = newUserId();

      await post(userId, { entries: [benchEntry(), benchEntry({ date: 'yesterday' })] }).expect(
        400,
      );

      expect(await prisma.workoutEntry.count({ where: { userId } })).toBe(0);
    });
  });

  describe('idempotency', () => {
    it('replays the original response for a retry with the same key and body', async () => {
      const userId = newUserId();
      const body = { entries: [benchEntry()] };

      const first = await post(userId, body, 'retry-1').expect(201);
      const retry = await post(userId, body, 'retry-1').expect(201);

      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      expect(await prisma.workoutEntry.count({ where: { userId } })).toBe(1);
    });

    it('treats key order differences in the body as the same request', async () => {
      const userId = newUserId();

      await post(userId, { entries: [benchEntry()] }, 'k').expect(201);
      await post(
        userId,
        {
          entries: [
            {
              sets: [{ unit: 'kg', weight: 100, reps: 5 }],
              exerciseName: 'Bench Press',
              date: '2026-10-01T07:30:00+07:00',
            },
          ],
        },
        'k',
      )
        .expect(201)
        .expect('Idempotent-Replayed', 'true');
    });

    it('rejects reusing a key with a different body (422 IDEMPOTENCY_KEY_REUSED)', async () => {
      const userId = newUserId();
      await post(userId, { entries: [benchEntry()] }, 'k-1').expect(201);

      const res = await post(
        userId,
        { entries: [benchEntry({ exerciseName: 'Deadlift' })] },
        'k-1',
      ).expect(422);

      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('scopes keys per user', async () => {
      await post(newUserId(), { entries: [benchEntry()] }, 'shared-key').expect(201);
      const res = await post(newUserId(), { entries: [benchEntry()] }, 'shared-key').expect(201);

      expect(res.headers['idempotent-replayed']).toBeUndefined();
    });

    it('creates exactly one batch when the same request is sent concurrently', async () => {
      const userId = newUserId();
      const body = { entries: [benchEntry(), benchEntry({ exerciseName: 'Deadlift' })] };

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => post(userId, body, 'double-click')),
      );

      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(new Set(responses.map((r) => r.body.data[0].id)).size).toBe(1);
      expect(await prisma.workoutEntry.count({ where: { userId } })).toBe(2);
    });
  });

  describe('concurrent writes without idempotency', () => {
    it('keeps both workouts when the same user logs the same exercise at the same time', async () => {
      const userId = newUserId();
      const body = { entries: [benchEntry()] };

      await Promise.all([post(userId, body).expect(201), post(userId, body).expect(201)]);

      expect(await prisma.workoutEntry.count({ where: { userId } })).toBe(2);
    });

    it('creates a brand-new exercise only once when two requests introduce it concurrently', async () => {
      const name = uniqueExerciseName('Landmine Press');
      const requests = Array.from({ length: 4 }, () =>
        post(newUserId(), { entries: [benchEntry({ exerciseName: name })] }),
      );

      const responses = await Promise.all(requests);

      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201]);
      expect(new Set(responses.map((r) => r.body.data[0].exerciseId)).size).toBe(1);
    });
  });
});
