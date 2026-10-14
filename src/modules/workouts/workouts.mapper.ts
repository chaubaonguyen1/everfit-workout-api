import { encodeCursor, roundTo } from '../../common/utils';
import type { WeightUnit } from '../units/domain/weight-unit.registry';
import { presentSet } from './domain/present-set';
import { LoggedEntryResponse, LoggedWorkoutsResponse } from './dto/logged-workouts.response';
import {
  HistoryEntryResponse,
  HistorySetResponse,
  WorkoutHistoryResponse,
} from './dto/workout-history.response';
import type { CreatedEntry, HistoryEntryRow, HistorySetRow } from './workouts.repository';

const KG_DECIMALS = 2;
export const EMPTY_HISTORY_MESSAGE = 'No workouts found for the given filters';

export function toLoggedWorkoutsResponse(entries: readonly CreatedEntry[]): LoggedWorkoutsResponse {
  return { data: entries.map(toLoggedEntryResponse) };
}

function toLoggedEntryResponse(entry: CreatedEntry): LoggedEntryResponse {
  return {
    id: entry.id,
    exerciseId: entry.exercise.id,
    exerciseName: entry.exercise.name,
    performedAt: entry.performedAt.toISOString(),
    timezone: entry.timezone,
    sets: entry.sets.map((set) => ({
      setIndex: set.setIndex,
      reps: set.reps,
      weight: set.weight,
      unit: set.unit,
      weightKg: roundTo(set.weightKg, KG_DECIMALS),
      volumeKg: roundTo(set.volumeKg, KG_DECIMALS),
      estimatedOneRepMaxKg: roundTo(set.estimatedOneRepMaxKg, KG_DECIMALS),
    })),
  };
}

export interface HistoryPageInput {
  /** Up to limit + 1 rows; the extra row only signals that another page exists. */
  readonly rows: readonly HistoryEntryRow[];
  readonly sets: readonly HistorySetRow[];
  readonly limit: number;
  /** Output unit; undefined = each set in the unit it was logged in. */
  readonly unit?: WeightUnit;
}

export function toWorkoutHistoryResponse({
  rows,
  sets,
  limit,
  unit,
}: HistoryPageInput): WorkoutHistoryResponse {
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = page[page.length - 1];

  const setsByEntry = new Map<string, HistorySetRow[]>();
  for (const set of sets) {
    const list = setsByEntry.get(set.entryId) ?? [];
    list.push(set);
    setsByEntry.set(set.entryId, list);
  }

  return {
    data: page.map((row) => toHistoryEntry(row, setsByEntry.get(row.id) ?? [], unit)),
    pageInfo: {
      limit,
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ performedAt: last.performedAt, id: last.id }) : null,
    },
    ...(page.length === 0 && { message: EMPTY_HISTORY_MESSAGE }),
  };
}

function toHistoryEntry(
  row: HistoryEntryRow,
  sets: readonly HistorySetRow[],
  unit: WeightUnit | undefined,
): HistoryEntryResponse {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    exerciseName: row.exerciseName,
    muscleGroups: row.muscleGroups,
    performedAt: row.performedAt.toISOString(),
    timezone: row.timezone,
    sets: sets.map((set) => toHistorySet(set, unit)),
  };
}

function toHistorySet(set: HistorySetRow, unit: WeightUnit | undefined): HistorySetResponse {
  return { setIndex: set.setIndex, ...presentSet(set, unit) };
}
