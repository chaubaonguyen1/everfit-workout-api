import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from '../utils/test-app';
import { newUserId } from '../utils/test-data';

describe('Personal records (e2e)', () => {
  let app: NestExpressApplication;
  const userId = newUserId('pr');

  const records = (query: Record<string, string>, user = userId) =>
    request(app.getHttpServer()).get(`/api/v1/users/${user}/personal-records`).query(query);
  const compare = (query: Record<string, string>, user = userId) =>
    request(app.getHttpServer()).get(`/api/v1/users/${user}/personal-records/compare`).query(query);

  const set = (reps: number, weight: number, unit = 'kg') => ({ reps, weight, unit });

  /*
   * Bench Press, by hand (kg):
   *   Sep 05  100×5 → vol 500,    e1RM 116.67   |  105×3 → vol 315, e1RM 115.5
   *   Oct 02  225 lb×5 = 102.06×5 → vol 510.29, e1RM 119.07  (all-time volume & 1RM)
   *   Oct 10  110×2 → vol 220, e1RM 117.33  (all-time max weight, first achieved)
   *   Oct 12  110×2 again                    (tie: must not move achievedAt)
   */
  beforeAll(async () => {
    app = await createTestApp();
    await request(app.getHttpServer())
      .post(`/api/v1/users/${userId}/workouts`)
      .send({
        entries: [
          {
            date: '2026-09-05T08:00:00Z',
            exerciseName: 'Bench Press',
            sets: [set(5, 100), set(3, 105)],
          },
          { date: '2026-10-02T08:00:00Z', exerciseName: 'Bench Press', sets: [set(5, 225, 'lb')] },
          { date: '2026-10-10T08:00:00Z', exerciseName: 'Bench Press', sets: [set(2, 110)] },
          { date: '2026-10-12T08:00:00Z', exerciseName: 'Bench Press', sets: [set(2, 110)] },
          // Oct 1 01:00 in Ho Chi Minh City, but still Sep 30 in UTC.
          { date: '2026-09-30T18:00:00Z', exerciseName: 'Deadlift', sets: [set(1, 200)] },
        ],
      })
      .expect(201);
    // Another user's heavier lifts must never count.
    await request(app.getHttpServer())
      .post(`/api/v1/users/${newUserId('other')}/workouts`)
      .send({ entries: [{ date: '2026-10-05', exerciseName: 'Bench Press', sets: [set(1, 300)] }] })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /personal-records', () => {
    it('returns all-time max weight, max volume and best Epley 1RM with the date achieved', async () => {
      const res = await records({ exercise: 'bench press' }).expect(200);

      expect(res.body.exercise.name).toBe('Bench Press');
      expect(res.body.unit).toBe('kg');
      expect(res.body.range).toEqual({ from: null, to: null });
      expect(res.body.records).toEqual({
        maxWeight: expect.objectContaining({
          value: 110,
          achievedAt: '2026-10-10T08:00:00.000Z', // first time, not the Oct 12 tie
          set: { reps: 2, weight: 110 },
        }),
        maxVolume: expect.objectContaining({
          value: 510.29,
          achievedAt: '2026-10-02T08:00:00.000Z',
          set: { reps: 5, weight: 102.06 },
        }),
        bestEstimatedOneRepMax: expect.objectContaining({
          value: 119.07,
          achievedAt: '2026-10-02T08:00:00.000Z',
        }),
      });
      expect(res.body).not.toHaveProperty('message');
    });

    it('restricts records to a date range', async () => {
      const res = await records({ exercise: 'Bench Press', from: '2026-09-01', to: '2026-09-30' });

      expect(res.body.records.maxWeight).toMatchObject({ value: 105, set: { reps: 3 } });
      expect(res.body.records.maxVolume.value).toBe(500);
      expect(res.body.records.bestEstimatedOneRepMax.value).toBe(116.67);
    });

    it('presents records in the requested unit, exact for sets logged in that unit', async () => {
      const res = await records({ exercise: 'Bench Press', unit: 'lb' }).expect(200);

      expect(res.body.unit).toBe('lb');
      expect(res.body.records.maxWeight.value).toBe(242.51);
      // Logged as 225 lb × 5 → exactly 1125 lb, not a kg round-trip approximation.
      expect(res.body.records.maxVolume).toMatchObject({
        value: 1125,
        set: { reps: 5, weight: 225 },
      });
    });

    it('returns 200 with null records and a message when the range has no data', async () => {
      const res = await records({ exercise: 'Bench Press', from: '2020-01-01', to: '2020-12-31' });

      expect(res.status).toBe(200);
      expect(res.body.records).toEqual({
        maxWeight: null,
        maxVolume: null,
        bestEstimatedOneRepMax: null,
      });
      expect(res.body.message).toBe('No sets recorded for this exercise in the given range');
    });

    it('returns 200 with null records for a known exercise the user never logged', async () => {
      const res = await records({ exercise: 'Bench Press' }, newUserId('nobody')).expect(200);

      expect(res.body.records.maxWeight).toBeNull();
    });

    it('returns 404 for an exercise that does not exist at all', async () => {
      const res = await records({ exercise: 'Underwater Basket Weaving' }).expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it.each([
      [{}, 'VALIDATION_ERROR', 'exercise'],
      [{ exercise: 'Bench Press', unit: 'stone' }, 'VALIDATION_ERROR', 'unit'],
      [{ exercise: 'Bench Press', from: 'soon' }, 'VALIDATION_ERROR', 'from'],
      [
        { exercise: 'Bench Press', from: '2026-10-02', to: '2026-10-01' },
        'INVALID_DATE_RANGE',
        'from',
      ],
    ])('%p → 400 %s', async (query, code, field) => {
      const res = await records(query as Record<string, string>).expect(400);

      expect(res.body.error.code).toBe(code);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    });
  });

  describe('GET /personal-records/compare', () => {
    it('compares this month with last month', async () => {
      const res = await compare({
        exercise: 'Bench Press',
        period: 'month',
        referenceDate: '2026-10-14',
      }).expect(200);

      expect(res.body.period).toBe('month');
      expect(res.body.current).toMatchObject({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-11-01T00:00:00.000Z',
      });
      expect(res.body.previous).toMatchObject({
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      });
      expect(res.body.current.records.maxWeight.value).toBe(110);
      expect(res.body.previous.records.maxWeight.value).toBe(105);
      expect(res.body.change).toEqual({
        maxWeight: { absolute: 5, percent: 4.8 },
        maxVolume: { absolute: 10.29, percent: 2.1 },
        bestEstimatedOneRepMax: { absolute: 2.4, percent: 2.1 },
      });
    });

    it('uses the client time zone for period boundaries', async () => {
      // The Deadlift at 2026-09-30T18:00Z is in October for Ho Chi Minh City, September for UTC.
      const local = await compare({
        exercise: 'Deadlift',
        period: 'month',
        referenceDate: '2026-10-14',
        timezone: 'Asia/Ho_Chi_Minh',
      }).expect(200);
      const utc = await compare({
        exercise: 'Deadlift',
        period: 'month',
        referenceDate: '2026-10-14',
      }).expect(200);

      expect(local.body.current.records.maxWeight?.value).toBe(200);
      expect(local.body.previous.records.maxWeight).toBeNull();
      expect(utc.body.current.records.maxWeight).toBeNull();
      expect(utc.body.previous.records.maxWeight?.value).toBe(200);
      // Only one side has a record, so there is no change to report.
      expect(local.body.change.maxWeight).toBeNull();
    });

    it('compares explicit ranges', async () => {
      const res = await compare({
        exercise: 'Bench Press',
        currentFrom: '2026-10-10',
        currentTo: '2026-10-12',
        previousFrom: '2026-10-01',
        previousTo: '2026-10-09',
      }).expect(200);

      expect(res.body.period).toBe('custom');
      expect(res.body.change.maxWeight).toEqual({ absolute: 7.94, percent: 7.8 });
    });

    it('returns 200 with a message when neither period has data', async () => {
      const res = await compare({
        exercise: 'Bench Press',
        period: 'week',
        referenceDate: '2020-06-15',
      }).expect(200);

      expect(res.body.message).toBe('No sets recorded for this exercise in either period');
      expect(res.body.change).toEqual({
        maxWeight: null,
        maxVolume: null,
        bestEstimatedOneRepMax: null,
      });
    });

    it.each([
      [{ exercise: 'Bench Press' }, 'period'],
      [{ exercise: 'Bench Press', period: 'year' }, 'period'],
      [{ exercise: 'Bench Press', period: 'month', currentFrom: '2026-10-01' }, 'period'],
      [
        { exercise: 'Bench Press', currentFrom: '2026-10-01', currentTo: '2026-10-02' },
        'previousFrom',
      ],
    ])('%p → 400 on %s', async (query, field) => {
      const res = await compare(query as Record<string, string>).expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    });
  });
});
