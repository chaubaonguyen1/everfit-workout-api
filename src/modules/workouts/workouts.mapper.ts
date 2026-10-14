import { roundTo } from '../../common/utils';
import { LoggedEntryResponse, LoggedWorkoutsResponse } from './dto/logged-workouts.response';
import type { CreatedEntry } from './workouts.repository';

const KG_DECIMALS = 2;

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
