import { DomainError, ErrorCode, ErrorDetail, ValidationError } from '../../../common/errors';
import {
  DEFAULT_TIME_ZONE,
  KeysetCursor,
  assertRangeOrder,
  decodeCursor,
  fingerprint,
  normalizeName,
  parseDateRange,
} from '../../../common/utils';

export const DEFAULT_PAGE_SIZE = 20;

export interface HistoryQueryInput {
  readonly exercise?: string;
  readonly muscleGroup?: string;
  readonly from?: string;
  readonly to?: string;
  readonly timezone?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface HistoryFilters {
  /** Normalized substring to match against exercise names. */
  readonly exerciseTerm?: string;
  readonly muscleGroup?: string;
  /** Half-open range: from ≤ performedAt < to. */
  readonly from?: Date;
  readonly to?: Date;
  readonly cursor?: KeysetCursor;
  /** Fingerprint of the row-selecting filters, embedded in the cursors issued for this query. */
  readonly cursorScope: string;
  readonly limit: number;
}

/**
 * Validates and resolves history query parameters. Dates without an offset are interpreted in
 * `timezone`; a date-only `to` includes that whole day.
 */
export function resolveHistoryFilters(
  query: HistoryQueryInput,
  knownMuscleGroups: readonly string[],
): HistoryFilters {
  const cursor = query.cursor === undefined ? undefined : resolveCursor(query.cursor);
  const problems: ErrorDetail[] = [];

  const range = parseDateRange(query, query.timezone ?? DEFAULT_TIME_ZONE, problems);

  const muscleGroup = query.muscleGroup?.trim().toLowerCase();
  if (muscleGroup !== undefined && !knownMuscleGroups.includes(muscleGroup)) {
    problems.push({
      field: 'muscleGroup',
      issue: `must be one of: ${knownMuscleGroups.join(', ')}`,
    });
  }

  if (problems.length > 0) throw new ValidationError('Invalid query parameters', problems);
  assertRangeOrder(range);

  const exerciseTerm =
    (query.exercise === undefined ? undefined : normalizeName(query.exercise)) || undefined;
  // Only filters that change which rows match; output unit and page size may vary between pages.
  const cursorScope = fingerprint({ exerciseTerm, muscleGroup, from: range.from, to: range.to });
  if (cursor && cursor.scope !== cursorScope) {
    throw new DomainError(
      ErrorCode.INVALID_CURSOR,
      'cursor was issued for different filters; restart from the first page',
      [{ field: 'cursor', issue: 'does not match the current filters' }],
    );
  }

  return {
    exerciseTerm,
    muscleGroup,
    from: range.from,
    to: range.to,
    cursor,
    cursorScope,
    limit: query.limit ?? DEFAULT_PAGE_SIZE,
  };
}

function resolveCursor(token: string): KeysetCursor {
  try {
    return decodeCursor(token);
  } catch (error) {
    throw new DomainError(ErrorCode.INVALID_CURSOR, (error as Error).message, [
      { field: 'cursor', issue: 'is invalid' },
    ]);
  }
}
