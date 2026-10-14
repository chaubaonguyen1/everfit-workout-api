import { WallTime, toWallTime, zonedWallTimeToUtc } from '../../../common/utils';

export type PeriodUnit = 'week' | 'month';
export const PERIOD_UNITS: readonly PeriodUnit[] = ['week', 'month'];

/** Half-open calendar period [from, to) as UTC instants. */
export interface Period {
  readonly from: Date;
  readonly to: Date;
}

/**
 * The calendar period (ISO week starting Monday, or month) containing `instant`, with
 * boundaries at local midnight in `timeZone` — "this month" for a coach in Ho Chi Minh City
 * starts at 2026-10-01 00:00 +07:00, not at UTC midnight. DST-safe via zonedWallTimeToUtc.
 */
export function periodContaining(instant: Date, unit: PeriodUnit, timeZone: string): Period {
  const local = toWallTime(instant, timeZone);
  const start =
    unit === 'month'
      ? calendarDay(local.year, local.month, 1)
      : calendarDay(local.year, local.month, local.day - daysSinceMonday(local));
  const end =
    unit === 'month'
      ? calendarDay(start.year, start.month + 1, 1)
      : calendarDay(start.year, start.month, start.day + 7);

  return { from: zonedWallTimeToUtc(start, timeZone), to: zonedWallTimeToUtc(end, timeZone) };
}

/** The period immediately before `period` (same unit). */
export function previousPeriod(period: Period, unit: PeriodUnit, timeZone: string): Period {
  // Any instant just before the current start lies in the previous period.
  return periodContaining(new Date(period.from.getTime() - 1), unit, timeZone);
}

function daysSinceMonday(wall: WallTime): number {
  const dayOfWeek = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay(); // 0 = Sun
  return (dayOfWeek + 6) % 7;
}

/** Midnight of a calendar day; out-of-range month/day values roll over (month 13 → next Jan). */
function calendarDay(year: number, month: number, day: number): WallTime {
  const normalized = new Date(Date.UTC(year, month - 1, day));
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate(),
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  };
}
