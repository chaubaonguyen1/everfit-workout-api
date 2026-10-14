import { DomainError, ErrorCode } from '../../../common/errors';
import { encodeCursor } from '../../../common/utils';
import { DEFAULT_PAGE_SIZE, HistoryQueryInput, resolveHistoryFilters } from './history-filters';

const groups = ['chest', 'quads', 'back'];
const resolve = (query: HistoryQueryInput) => resolveHistoryFilters(query, groups);

function failure(query: HistoryQueryInput): DomainError {
  try {
    resolve(query);
  } catch (error) {
    return error as DomainError;
  }
  throw new Error('expected an error');
}

describe('resolveHistoryFilters', () => {
  it('applies defaults when no filters are given', () => {
    expect(resolve({})).toEqual({
      exerciseTerm: undefined,
      muscleGroup: undefined,
      from: undefined,
      to: undefined,
      cursor: undefined,
      limit: DEFAULT_PAGE_SIZE,
    });
  });

  it('normalizes the exercise search term', () => {
    expect(resolve({ exercise: '  BENCH  pr ' }).exerciseTerm).toBe('bench pr');
  });

  it('ignores a blank exercise term instead of matching everything with "%%"', () => {
    expect(resolve({ exercise: '   ' }).exerciseTerm).toBeUndefined();
  });

  it('resolves a date-only range in the given zone, including the whole `to` day', () => {
    const filters = resolve({ from: '2026-10-01', to: '2026-10-31', timezone: 'Asia/Ho_Chi_Minh' });

    expect(filters.from?.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(filters.to?.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('accepts a single-day range (from = to as dates)', () => {
    expect(() => resolve({ from: '2026-10-14', to: '2026-10-14' })).not.toThrow();
  });

  it('rejects from >= to with INVALID_DATE_RANGE', () => {
    expect(failure({ from: '2026-10-15', to: '2026-10-14' }).code).toBe(
      ErrorCode.INVALID_DATE_RANGE,
    );
  });

  it('collects malformed dates and unknown muscle groups in one VALIDATION_ERROR', () => {
    const error = failure({ from: 'yesterday', to: '2026-02-30', muscleGroup: 'wings' });

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.details.map((d) => d.field)).toEqual(['from', 'to', 'muscleGroup']);
    expect(error.details[2].issue).toBe('must be one of: chest, quads, back');
  });

  it('matches muscle groups case-insensitively', () => {
    expect(resolve({ muscleGroup: ' Chest ' }).muscleGroup).toBe('chest');
  });

  it('decodes a valid cursor and rejects a tampered one with INVALID_CURSOR', () => {
    const cursor = {
      performedAt: new Date('2026-10-14T00:00:00.000Z'),
      id: '0b1f6c3e-8a2d-4f7e-9c1a-2b3c4d5e6f70',
    };

    expect(resolve({ cursor: encodeCursor(cursor) }).cursor).toEqual(cursor);
    expect(failure({ cursor: 'tampered' }).code).toBe(ErrorCode.INVALID_CURSOR);
  });
});
