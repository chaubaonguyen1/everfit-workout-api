import { DomainError, ErrorCode, ErrorDetail } from '../errors';
import { parseInstant, parseRangeEnd } from './date.util';

/** Half-open instant range: from ≤ t < to. Either bound may be open. */
export interface DateRange {
  readonly from?: Date;
  readonly to?: Date;
}

export interface DateRangeFields {
  readonly from: string;
  readonly to: string;
}

const DEFAULT_FIELDS: DateRangeFields = { from: 'from', to: 'to' };

/**
 * Parses a `from`/`to` pair in `timeZone` (a date-only `to` covers that whole day).
 * Format problems are appended to `problems` (so callers can report them together with other
 * query errors); call {@link assertRangeOrder} afterwards to reject inverted ranges.
 */
export function parseDateRange(
  input: { readonly from?: string; readonly to?: string },
  timeZone: string,
  problems: ErrorDetail[],
  fields: DateRangeFields = DEFAULT_FIELDS,
): DateRange {
  return {
    from: parseBound(input.from, fields.from, (v) => parseInstant(v, timeZone), problems),
    to: parseBound(input.to, fields.to, (v) => parseRangeEnd(v, timeZone), problems),
  };
}

/** @throws DomainError INVALID_DATE_RANGE when from ≥ to. */
export function assertRangeOrder(range: DateRange, fields: DateRangeFields = DEFAULT_FIELDS): void {
  if (range.from && range.to && range.from.getTime() >= range.to.getTime()) {
    throw new DomainError(
      ErrorCode.INVALID_DATE_RANGE,
      `\`${fields.from}\` must be before \`${fields.to}\``,
      [
        {
          field: fields.from,
          issue: `must be before ${range.to.toISOString()} (exclusive end of \`${fields.to}\`)`,
        },
      ],
    );
  }
}

function parseBound(
  value: string | undefined,
  field: string,
  parse: (value: string) => Date,
  problems: ErrorDetail[],
): Date | undefined {
  if (value === undefined) return undefined;
  try {
    return parse(value);
  } catch (error) {
    problems.push({ field, issue: error instanceof RangeError ? error.message : 'is invalid' });
    return undefined;
  }
}
