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
      cursorScope: expect.stringMatching(/^[0-9a-f]{16}$/),
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

  describe('cursor', () => {
    const issuedFor = (query: HistoryQueryInput) =>
      encodeCursor({
        performedAt: new Date('2026-10-14T00:00:00.000Z'),
        id: '0b1f6c3e-8a2d-4f7e-9c1a-2b3c4d5e6f70',
        scope: resolve(query).cursorScope,
      });

    it('accepts a cursor issued for the same filters', () => {
      const cursor = issuedFor({ exercise: 'bench' });

      expect(resolve({ exercise: 'bench', cursor }).cursor?.id).toBe(
        '0b1f6c3e-8a2d-4f7e-9c1a-2b3c4d5e6f70',
      );
    });

    it('ignores output-only parameters when matching (unit/limit can change between pages)', () => {
      const cursor = issuedFor({ exercise: 'bench', limit: 10 });

      expect(() => resolve({ exercise: 'BENCH ', limit: 50, cursor })).not.toThrow();
    });

    it('rejects a cursor reused with different filters', () => {
      const cursor = issuedFor({ exercise: 'bench' });

      const error = failure({ exercise: 'squat', cursor });
      expect(error.code).toBe(ErrorCode.INVALID_CURSOR);
      expect(error.message).toMatch(/different filters/);
    });

    it('rejects a tampered cursor', () => {
      expect(failure({ cursor: 'tampered' }).code).toBe(ErrorCode.INVALID_CURSOR);
    });
  });
});
