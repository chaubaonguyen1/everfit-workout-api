import { ValidationError } from '../../../common/errors';
import { EntryInput, distinctExercises, prepareEntries } from './prepare-entries';

const now = new Date('2026-10-14T12:00:00Z');
const entry = (overrides: Partial<EntryInput> = {}): EntryInput => ({
  date: '2026-10-14T07:30:00+07:00',
  exerciseName: 'Bench Press',
  sets: [{ reps: 5, weight: 100, unit: 'kg' }],
  ...overrides,
});

function errorsOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return (error as ValidationError).details;
  }
  throw new Error('expected a ValidationError');
}

describe('prepareEntries', () => {
  it('normalizes weights to kg, keeps the original value and computes metrics per set', () => {
    const [prepared] = prepareEntries([entry({ sets: [{ reps: 5, weight: 225, unit: 'lb' }] })], {
      now,
    });

    expect(prepared.sets[0]).toEqual({
      setIndex: 0,
      reps: 5,
      weight: 225,
      unit: 'lb',
      weightKg: expect.closeTo(102.0583, 4),
      volumeKg: expect.closeTo(510.2914, 4),
      estimatedOneRepMaxKg: expect.closeTo(119.068, 3),
    });
  });

  it('numbers sets in request order', () => {
    const [prepared] = prepareEntries(
      [
        entry({
          sets: [
            { reps: 5, weight: 100, unit: 'kg' },
            { reps: 3, weight: 110, unit: 'kg' },
          ],
        }),
      ],
      { now },
    );

    expect(prepared.sets.map((s) => s.setIndex)).toEqual([0, 1]);
  });

  it('interprets dates without an offset in the request time zone', () => {
    const [prepared] = prepareEntries([entry({ date: '2026-10-14' })], {
      now,
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    expect(prepared.performedAt.toISOString()).toBe('2026-10-13T17:00:00.000Z');
  });

  it('keeps a readable display name and a normalized identity', () => {
    const [prepared] = prepareEntries([entry({ exerciseName: '  bench   PRESS ' })], { now });

    expect(prepared.exercise).toEqual({ name: 'bench PRESS', normalizedName: 'bench press' });
  });

  it('reports every invalid date in the batch with its path', () => {
    const details = errorsOf(() =>
      prepareEntries(
        [entry({ date: '2026-02-30' }), entry(), entry({ date: '2026-10-20T00:00:00Z' })],
        { now },
      ),
    );

    expect(details).toEqual([
      { field: 'entries[0].date', issue: 'is not a valid calendar date/time' },
      { field: 'entries[2].date', issue: 'must not be more than 24 hours in the future' },
    ]);
  });

  it('tolerates small future skew (e.g. a client ahead in time zone)', () => {
    expect(() => prepareEntries([entry({ date: '2026-10-15T06:00:00Z' })], { now })).not.toThrow();
  });

  it('rejects absurdly old dates', () => {
    expect(errorsOf(() => prepareEntries([entry({ date: '1850-01-01' })], { now }))).toEqual([
      { field: 'entries[0].date', issue: 'must not be before 1900-01-01' },
    ]);
  });
});

describe('distinctExercises', () => {
  it('de-duplicates by normalized name and sorts for a stable lock order', () => {
    const prepared = prepareEntries(
      [
        entry({ exerciseName: 'Squat' }),
        entry({ exerciseName: 'bench press' }),
        entry({ exerciseName: 'Bench  Press' }),
      ],
      { now },
    );

    expect(distinctExercises(prepared).map((e) => e.normalizedName)).toEqual([
      'bench press',
      'squat',
    ]);
  });
});
