import { decodeCursor } from '../../common/utils';
import { toKg } from '../units/domain/weight-conversion';
import { computeSetMetrics } from './domain/set-metrics';
import { EMPTY_HISTORY_MESSAGE, toWorkoutHistoryResponse } from './workouts.mapper';
import type { HistoryEntryRow, HistorySetRow } from './workouts.repository';

const SCOPE = '0123456789abcdef';

const entry = (n: number): HistoryEntryRow => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  exerciseId: '10000000-0000-4000-8000-000000000000',
  exerciseName: 'Bench Press',
  muscleGroups: ['chest'],
  performedAt: new Date(Date.UTC(2026, 9, 10 - n)),
  timezone: null,
});

const set = (
  entryId: string,
  setIndex: number,
  weight: number,
  unit: 'kg' | 'lb',
): HistorySetRow => {
  const weightKg = toKg(weight, unit);
  const metrics = computeSetMetrics(weightKg, 5);
  return {
    entryId,
    setIndex,
    reps: 5,
    weight,
    unit,
    weightKg,
    volumeKg: metrics.volumeKg,
    e1rmKg: metrics.estimatedOneRepMaxKg,
  };
};

describe('toWorkoutHistoryResponse', () => {
  it('has no next page when exactly `limit` rows came back', () => {
    const res = toWorkoutHistoryResponse({
      rows: [entry(1), entry(2)],
      sets: [],
      limit: 2,
      cursorScope: SCOPE,
    });

    expect(res.data).toHaveLength(2);
    expect(res.pageInfo).toEqual({ limit: 2, hasMore: false, nextCursor: null });
  });

  it('drops the look-ahead row and points the cursor at the last returned row, with the filter scope', () => {
    const rows = [entry(1), entry(2), entry(3)];

    const res = toWorkoutHistoryResponse({ rows, sets: [], limit: 2, cursorScope: SCOPE });

    expect(res.data.map((e) => e.id)).toEqual([rows[0].id, rows[1].id]);
    expect(res.pageInfo.hasMore).toBe(true);
    expect(decodeCursor(res.pageInfo.nextCursor as string)).toEqual({
      performedAt: rows[1].performedAt,
      id: rows[1].id,
      scope: SCOPE,
    });
  });

  it('adds a message (not an error) when the page is empty', () => {
    const res = toWorkoutHistoryResponse({ rows: [], sets: [], limit: 20, cursorScope: SCOPE });

    expect(res).toEqual({
      data: [],
      pageInfo: { limit: 20, hasMore: false, nextCursor: null },
      message: EMPTY_HISTORY_MESSAGE,
    });
  });

  it('attaches each entry’s sets in set order and leaves entries without sets empty', () => {
    const [a, b] = [entry(1), entry(2)];
    const sets = [set(a.id, 0, 100, 'kg'), set(a.id, 1, 105, 'kg')];

    const res = toWorkoutHistoryResponse({ rows: [a, b], sets, limit: 20, cursorScope: SCOPE });

    expect(res.data[0].sets.map((s) => s.setIndex)).toEqual([0, 1]);
    expect(res.data[1].sets).toEqual([]);
  });

  it('presents sets in the requested unit, or each in its logged unit by default', () => {
    const a = entry(1);
    const sets = [set(a.id, 0, 225, 'lb'), set(a.id, 1, 100, 'kg')];

    const asLogged = toWorkoutHistoryResponse({ rows: [a], sets, limit: 20, cursorScope: SCOPE });
    const inKg = toWorkoutHistoryResponse({
      rows: [a],
      sets,
      limit: 20,
      unit: 'kg',
      cursorScope: SCOPE,
    });

    expect(asLogged.data[0].sets.map((s) => [s.weight, s.unit])).toEqual([
      [225, 'lb'],
      [100, 'kg'],
    ]);
    expect(inKg.data[0].sets.map((s) => [s.weight, s.unit, s.volume])).toEqual([
      [102.06, 'kg', 510.29],
      [100, 'kg', 500],
    ]);
  });
});
