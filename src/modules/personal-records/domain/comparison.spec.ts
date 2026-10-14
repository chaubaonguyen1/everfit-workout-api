import { DomainError, ErrorCode } from '../../../common/errors';
import { ComparisonQueryInput, computeChange, resolveComparisonPeriods } from './comparison';

const now = new Date('2026-10-14T12:00:00Z');
const iso = (d: Date) => d.toISOString();

function failure(query: ComparisonQueryInput): DomainError {
  try {
    resolveComparisonPeriods(query, now);
  } catch (error) {
    return error as DomainError;
  }
  throw new Error('expected an error');
}

describe('resolveComparisonPeriods', () => {
  it('period=month → this month vs last month in the client zone', () => {
    const result = resolveComparisonPeriods({ period: 'month', timezone: 'Asia/Ho_Chi_Minh' }, now);

    expect(result.mode).toBe('month');
    expect([iso(result.current.from), iso(result.current.to)]).toEqual([
      '2026-09-30T17:00:00.000Z',
      '2026-10-31T17:00:00.000Z',
    ]);
    expect([iso(result.previous.from), iso(result.previous.to)]).toEqual([
      '2026-08-31T17:00:00.000Z',
      '2026-09-30T17:00:00.000Z',
    ]);
  });

  it('period=week with a referenceDate picks that week and the one before', () => {
    const result = resolveComparisonPeriods({ period: 'week', referenceDate: '2026-03-04' }, now);

    expect(iso(result.current.from)).toBe('2026-03-02T00:00:00.000Z');
    expect(iso(result.previous.from)).toBe('2026-02-23T00:00:00.000Z');
  });

  it('explicit ranges, with a date-only end covering that day', () => {
    const result = resolveComparisonPeriods(
      {
        currentFrom: '2026-10-01',
        currentTo: '2026-10-14',
        previousFrom: '2026-09-01',
        previousTo: '2026-09-14',
      },
      now,
    );

    expect(result.mode).toBe('custom');
    expect(iso(result.current.to)).toBe('2026-10-15T00:00:00.000Z');
  });

  it.each<[string, ComparisonQueryInput, string[]]>([
    ['nothing given', {}, ['period']],
    ['period + explicit ranges', { period: 'month', currentFrom: '2026-10-01' }, ['period']],
    [
      'incomplete explicit ranges',
      { currentFrom: '2026-10-01', currentTo: '2026-10-02' },
      ['previousFrom', 'previousTo'],
    ],
    ['unknown period', { period: 'year' as never }, ['period']],
    ['referenceDate without period', { referenceDate: '2026-10-01' }, ['referenceDate']],
    ['bad referenceDate', { period: 'month', referenceDate: 'soon' }, ['referenceDate']],
  ])('rejects %s', (_label, query, fields) => {
    const error = failure(query);

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.details.map((d) => d.field)).toEqual(fields);
  });

  it('rejects inverted explicit ranges with INVALID_DATE_RANGE naming the field', () => {
    const error = failure({
      currentFrom: '2026-10-14',
      currentTo: '2026-10-01',
      previousFrom: '2026-09-01',
      previousTo: '2026-09-14',
    });

    expect(error.code).toBe(ErrorCode.INVALID_DATE_RANGE);
    expect(error.details[0].field).toBe('currentFrom');
  });
});

describe('computeChange', () => {
  it('absolute and percent change', () => {
    expect(computeChange(110, 100)).toEqual({ absolute: 10, percent: 10 });
    expect(computeChange(95.5, 100)).toEqual({ absolute: -4.5, percent: -4.5 });
  });

  it('is null when either side has no record', () => {
    expect(computeChange(null, 100)).toBeNull();
    expect(computeChange(100, undefined)).toBeNull();
  });

  it('percent is null (not Infinity) when the previous value is 0', () => {
    expect(computeChange(20, 0)).toEqual({ absolute: 20, percent: null });
  });
});
