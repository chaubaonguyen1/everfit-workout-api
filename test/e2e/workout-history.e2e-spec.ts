import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from '../utils/test-app';
import { newUserId } from '../utils/test-data';

interface HistoryEntry {
  id: string;
  exerciseName: string;
  performedAt: string;
  sets: { weight: number; unit: string; volume: number; estimatedOneRepMax: number }[];
}

describe('GET /api/v1/users/:userId/workouts (e2e)', () => {
  let app: NestExpressApplication;
  const userId = newUserId('history');

  const history = (query: Record<string, string | number> = {}, user = userId) =>
    request(app.getHttpServer()).get(`/api/v1/users/${user}/workouts`).query(query);

  const set = (weight: number, unit = 'kg', reps = 5) => ({ reps, weight, unit });

  beforeAll(async () => {
    app = await createTestApp();
    await request(app.getHttpServer())
      .post(`/api/v1/users/${userId}/workouts`)
      .send({
        entries: [
          { date: '2026-09-01T08:00:00Z', exerciseName: 'Bench Press', sets: [set(100)] },
          { date: '2026-09-15T08:00:00Z', exerciseName: 'Back Squat', sets: [set(140)] },
          { date: '2026-10-01T08:00:00Z', exerciseName: 'Incline Bench Press', sets: [set(80)] },
          // Three entries sharing one timestamp: pagination must neither skip nor repeat them.
          { date: '2026-10-10T08:00:00Z', exerciseName: 'Bench Press', sets: [set(225, 'lb')] },
          { date: '2026-10-10T08:00:00Z', exerciseName: 'Deadlift', sets: [set(180)] },
          { date: '2026-10-10T08:00:00Z', exerciseName: 'Back Squat', sets: [set(150)] },
          // 23:30 on Oct 12 in Ho Chi Minh City = 16:30Z.
          { date: '2026-10-12T16:30:00Z', exerciseName: 'Lat Pulldown', sets: [set(60)] },
          // 18:00Z is still Oct 12 in UTC but already Oct 13 01:00 in Ho Chi Minh City.
          { date: '2026-10-12T18:00:00Z', exerciseName: 'Barbell Row', sets: [set(70)] },
        ],
      })
      .expect(201);
    // Another user's data must never leak into this user's history.
    await request(app.getHttpServer())
      .post(`/api/v1/users/${newUserId('other')}/workouts`)
      .send({ entries: [{ date: '2026-10-11', exerciseName: 'Bench Press', sets: [set(300)] }] })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the user’s entries newest first', async () => {
    const res = await history().expect(200);

    const dates = res.body.data.map((e: HistoryEntry) => e.performedAt);
    expect(res.body.data).toHaveLength(8);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(res.body.pageInfo).toEqual({ limit: 20, hasMore: false, nextCursor: null });
  });

  it('pages with a cursor without skipping or repeating entries that share a timestamp', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const res = await history({ limit: 2, ...(cursor && { cursor }) }).expect(200);
      seen.push(...res.body.data.map((e: HistoryEntry) => e.id));
      cursor = res.body.pageInfo.nextCursor ?? undefined;
      pages++;
    } while (cursor && pages < 10);

    const all = (await history().expect(200)).body.data.map((e: HistoryEntry) => e.id);
    expect(pages).toBe(4);
    expect(seen).toEqual(all);
    expect(new Set(seen).size).toBe(8);
  });

  it('filters by partial, case-insensitive exercise name', async () => {
    const res = await history({ exercise: 'BENCH' }).expect(200);

    expect(res.body.data.map((e: HistoryEntry) => e.exerciseName).sort()).toEqual([
      'Bench Press',
      'Bench Press',
      'Incline Bench Press',
    ]);
  });

  it('treats LIKE wildcards in the search term literally', async () => {
    const res = await history({ exercise: '%' }).expect(200);

    expect(res.body.data).toEqual([]);
  });

  it('filters by muscle group from the configurable catalog', async () => {
    const res = await history({ muscleGroup: 'quads' }).expect(200);

    expect(res.body.data.map((e: HistoryEntry) => e.exerciseName)).toEqual([
      'Back Squat',
      'Back Squat',
    ]);
  });

  it('combines filters', async () => {
    const res = await history({ exercise: 'bench', from: '2026-10-01' }).expect(200);

    expect(res.body.data).toHaveLength(2);
  });

  it('interprets date ranges in the requested time zone, including the whole `to` day', async () => {
    const names = (res: request.Response) =>
      res.body.data.map((e: HistoryEntry) => e.exerciseName).sort();

    // Oct 12 in UTC: both the 16:30Z and the 18:00Z entries.
    const utc = await history({ from: '2026-10-12', to: '2026-10-12' }).expect(200);
    expect(names(utc)).toEqual(['Barbell Row', 'Lat Pulldown']);

    // Oct 12 in Ho Chi Minh City (UTC+7): 16:30Z is 23:30 that day, 18:00Z is already Oct 13.
    const local = await history({
      from: '2026-10-12',
      to: '2026-10-12',
      timezone: 'Asia/Ho_Chi_Minh',
    }).expect(200);
    expect(names(local)).toEqual(['Lat Pulldown']);
  });

  it('ignores a blank exercise filter instead of rejecting it', async () => {
    const res = await history({ exercise: '' }).expect(200);

    expect(res.body.data).toHaveLength(8);
  });

  it('pages through filtered results', async () => {
    const first = await history({ exercise: 'bench', limit: 2 }).expect(200);
    const second = await history({
      exercise: 'bench',
      limit: 2,
      cursor: first.body.pageInfo.nextCursor,
    }).expect(200);

    expect(first.body.pageInfo.hasMore).toBe(true);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.pageInfo).toMatchObject({ hasMore: false, nextCursor: null });
    expect(second.body.data[0].exerciseName).toMatch(/Bench/);
  });

  it('rejects a cursor reused with different filters', async () => {
    const first = await history({ exercise: 'bench', limit: 1 }).expect(200);

    const res = await history({ exercise: 'squat', cursor: first.body.pageInfo.nextCursor }).expect(
      400,
    );

    expect(res.body.error.code).toBe('INVALID_CURSOR');
  });

  it('returns each set in its logged unit by default', async () => {
    const res = await history({ exercise: 'bench press', from: '2026-10-10', to: '2026-10-10' });

    expect(res.body.data[0].sets[0]).toMatchObject({ weight: 225, unit: 'lb', volume: 1125 });
  });

  it('converts every set to the requested unit, keeping logged-unit values exact', async () => {
    const lb = await history({ unit: 'lb', from: '2026-10-10', to: '2026-10-10' }).expect(200);
    const byName = Object.fromEntries(
      lb.body.data.map((e: HistoryEntry) => [e.exerciseName, e.sets[0]]),
    );

    expect(byName['Bench Press']).toMatchObject({ weight: 225, unit: 'lb' });
    expect(byName['Deadlift']).toMatchObject({ weight: 396.83, unit: 'lb' });

    const kg = await history({ unit: 'kg', from: '2026-10-10', to: '2026-10-10' }).expect(200);
    const bench = kg.body.data.find((e: HistoryEntry) => e.exerciseName === 'Bench Press');
    expect(bench.sets[0]).toMatchObject({ weight: 102.06, unit: 'kg', estimatedOneRepMax: 119.07 });
  });

  it('returns 200 with an empty list and a message when nothing matches', async () => {
    const res = await history({ from: '2020-01-01', to: '2020-01-31' }).expect(200);

    expect(res.body).toEqual({
      data: [],
      pageInfo: { limit: 20, hasMore: false, nextCursor: null },
      message: 'No workouts found for the given filters',
    });
  });

  it('returns an empty page (not an error) for a user without workouts', async () => {
    const res = await history({}, newUserId('nobody')).expect(200);

    expect(res.body.data).toEqual([]);
  });

  describe('errors', () => {
    it.each([
      [{ cursor: 'garbage' }, 'INVALID_CURSOR', 'cursor'],
      [{ from: '2026-10-15', to: '2026-10-14' }, 'INVALID_DATE_RANGE', 'from'],
      [{ from: 'last week' }, 'VALIDATION_ERROR', 'from'],
      [{ muscleGroup: 'wings' }, 'VALIDATION_ERROR', 'muscleGroup'],
      [{ unit: 'stone' }, 'VALIDATION_ERROR', 'unit'],
      [{ limit: 0 }, 'VALIDATION_ERROR', 'limit'],
      [{ limit: 101 }, 'VALIDATION_ERROR', 'limit'],
      [{ timezone: 'Mars/Base' }, 'VALIDATION_ERROR', 'timezone'],
      [{ sort: 'asc' }, 'VALIDATION_ERROR', 'sort'],
    ])('%p → 400 %s', async (query, code, field) => {
      const res = await history(query).expect(400);

      expect(res.body.error.code).toBe(code);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    });
  });
});
