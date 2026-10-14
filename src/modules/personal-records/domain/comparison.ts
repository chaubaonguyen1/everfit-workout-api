import { ErrorDetail, ValidationError } from '../../../common/errors';
import {
  DEFAULT_TIME_ZONE,
  assertRangeOrder,
  parseDateRange,
  parseInstant,
  roundTo,
} from '../../../common/utils';
import { PERIOD_UNITS, Period, PeriodUnit, periodContaining, previousPeriod } from './period';

export interface ComparisonQueryInput {
  readonly period?: PeriodUnit;
  /** Any date inside the "current" period; defaults to now. */
  readonly referenceDate?: string;
  readonly currentFrom?: string;
  readonly currentTo?: string;
  readonly previousFrom?: string;
  readonly previousTo?: string;
  readonly timezone?: string;
}

export interface ComparisonPeriods {
  readonly mode: PeriodUnit | 'custom';
  readonly current: Period;
  readonly previous: Period;
}

const CUSTOM_FIELDS = ['currentFrom', 'currentTo', 'previousFrom', 'previousTo'] as const;

/**
 * Two ways to choose what to compare:
 * - `period=week|month` → the calendar period containing `referenceDate` (default now) vs the one
 *   before it, in the client's time zone ("PR this month vs last month");
 * - explicit `currentFrom/currentTo/previousFrom/previousTo` for arbitrary ranges.
 */
export function resolveComparisonPeriods(
  query: ComparisonQueryInput,
  now: Date,
): ComparisonPeriods {
  const timeZone = query.timezone ?? DEFAULT_TIME_ZONE;
  const customGiven = CUSTOM_FIELDS.filter((f) => query[f] !== undefined);

  if (query.period && customGiven.length > 0) {
    throw new ValidationError('Use either `period` or explicit ranges, not both', [
      { field: 'period', issue: `cannot be combined with ${customGiven.join(', ')}` },
    ]);
  }

  if (query.period) {
    if (!PERIOD_UNITS.includes(query.period)) {
      throw new ValidationError('Invalid period', [
        { field: 'period', issue: `must be one of: ${PERIOD_UNITS.join(', ')}` },
      ]);
    }
    const reference = resolveReference(query.referenceDate, timeZone, now);
    const current = periodContaining(reference, query.period, timeZone);
    return {
      mode: query.period,
      current,
      previous: previousPeriod(current, query.period, timeZone),
    };
  }

  if (query.referenceDate !== undefined) {
    throw new ValidationError('`referenceDate` only applies with `period`', [
      { field: 'referenceDate', issue: 'requires period=week|month' },
    ]);
  }

  const missing = CUSTOM_FIELDS.filter((f) => query[f] === undefined);
  if (missing.length > 0) {
    throw new ValidationError('Provide `period`, or all four explicit range bounds', [
      ...(customGiven.length === 0
        ? [{ field: 'period', issue: 'is required unless explicit ranges are given' }]
        : missing.map((field) => ({ field, issue: 'is required for an explicit comparison' }))),
    ]);
  }

  const problems: ErrorDetail[] = [];
  const currentFields = { from: 'currentFrom', to: 'currentTo' };
  const previousFields = { from: 'previousFrom', to: 'previousTo' };
  const current = parseDateRange(
    { from: query.currentFrom, to: query.currentTo },
    timeZone,
    problems,
    currentFields,
  );
  const previous = parseDateRange(
    { from: query.previousFrom, to: query.previousTo },
    timeZone,
    problems,
    previousFields,
  );
  if (problems.length > 0) throw new ValidationError('Invalid query parameters', problems);
  assertRangeOrder(current, currentFields);
  assertRangeOrder(previous, previousFields);

  return {
    mode: 'custom',
    current: current as Period,
    previous: previous as Period,
  };
}

export interface RecordChange {
  readonly absolute: number;
  /** Null when the previous value is 0 (percentage undefined). */
  readonly percent: number | null;
}

/** Change from previous to current; null unless both periods have a record. */
export function computeChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): RecordChange | null {
  if (current == null || previous == null) return null;
  return {
    absolute: roundTo(current - previous, 2),
    percent: previous === 0 ? null : roundTo(((current - previous) / previous) * 100, 1),
  };
}

function resolveReference(value: string | undefined, timeZone: string, now: Date): Date {
  if (value === undefined) return now;
  try {
    return parseInstant(value, timeZone);
  } catch (error) {
    throw new ValidationError('Invalid referenceDate', [
      { field: 'referenceDate', issue: error instanceof RangeError ? error.message : 'is invalid' },
    ]);
  }
}
