/**
 * Time-zone aware date parsing built on the platform `Intl` API (no external dependency).
 *
 * Strategy: every instant is stored in UTC. Inputs that carry an offset (`Z`, `+07:00`) are
 * absolute. Inputs without one — a date (`2026-10-14`) or a local date-time
 * (`2026-10-14T07:30`) — are wall-clock times interpreted in the given IANA time zone.
 */

export const DEFAULT_TIME_ZONE = 'UTC';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/i;

export interface WallTime {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock time of `instant` in `timeZone` (milliseconds preserved). */
export function toWallTime(instant: Date, timeZone: string): WallTime {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    millisecond: instant.getUTCMilliseconds(),
  };
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds (e.g. +7h for Asia/Ho_Chi_Minh). */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  return wallTimeAsUtcMs(toWallTime(instant, timeZone)) - instant.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * UTC instant of a wall-clock time in `timeZone`, with the same rules as java.time / Temporal's
 * "compatible" disambiguation:
 * - normal time → the single matching instant;
 * - overlap (clocks set back, the wall time happens twice) → the earlier instant;
 * - gap (clocks set forward, the wall time never happens) → shifted forward by the gap length,
 *   so e.g. a date-only input in a zone that skips midnight still lands on that same day.
 * Candidates use the offsets a day before and after, which bracket any single transition.
 */
export function zonedWallTimeToUtc(wall: WallTime, timeZone: string): Date {
  const wallMs = wallTimeAsUtcMs(wall);
  const offsetBefore = timeZoneOffsetMs(new Date(wallMs - DAY_MS), timeZone);
  const offsetAfter = timeZoneOffsetMs(new Date(wallMs + DAY_MS), timeZone);

  const matches = [wallMs - offsetBefore, wallMs - offsetAfter]
    .filter((candidate) => wallTimeAsUtcMs(toWallTime(new Date(candidate), timeZone)) === wallMs)
    .sort((a, b) => a - b);

  return new Date(matches[0] ?? wallMs - offsetBefore);
}

/**
 * Parses an ISO-8601 date or date-time into a UTC instant.
 * @throws RangeError with a client-safe message when the input or time zone is invalid.
 */
export function parseInstant(input: string, timeZone: string = DEFAULT_TIME_ZONE): Date {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Unknown time zone "${timeZone}"`);
  }

  const dateOnly = DATE_ONLY.exec(input);
  if (dateOnly) {
    const wall = toWall(dateOnly.slice(1, 4), ['0', '0', '0', '0']);
    return zonedWallTimeToUtc(wall, timeZone);
  }

  const dateTime = DATE_TIME.exec(input);
  if (!dateTime) {
    throw new RangeError('must be an ISO-8601 date (YYYY-MM-DD) or date-time');
  }

  const [, y, mo, d, h, mi, s = '0', fraction = '0', offset] = dateTime;
  const wall = toWall([y, mo, d], [h, mi, s, fraction.padEnd(3, '0').slice(0, 3)]);
  if (!offset) return zonedWallTimeToUtc(wall, timeZone);

  const offsetMs = offset.toUpperCase() === 'Z' ? 0 : parseOffsetMs(offset);
  return new Date(wallTimeAsUtcMs(wall) - offsetMs);
}

function toWall([y, mo, d]: string[], [h, mi, s, ms]: string[]): WallTime {
  const wall: WallTime = {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
    second: Number(s),
    millisecond: Number(ms),
  };
  assertValidWallTime(wall);
  return wall;
}

/** Rejects impossible calendar values that `Date` would silently roll over (Feb 30 → Mar 2). */
function assertValidWallTime(wall: WallTime): void {
  const probe = new Date(wallTimeAsUtcMs(wall));
  const matches =
    probe.getUTCFullYear() === wall.year &&
    probe.getUTCMonth() + 1 === wall.month &&
    probe.getUTCDate() === wall.day &&
    probe.getUTCHours() === wall.hour &&
    probe.getUTCMinutes() === wall.minute &&
    probe.getUTCSeconds() === wall.second;
  if (!matches) throw new RangeError('is not a valid calendar date/time');
}

function parseOffsetMs(offset: string): number {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(':').map(Number);
  if (hours > 14 || minutes > 59) throw new RangeError('has an invalid UTC offset');
  return sign * (hours * 60 + minutes) * 60_000;
}

function wallTimeAsUtcMs(w: WallTime): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, w.millisecond);
}
