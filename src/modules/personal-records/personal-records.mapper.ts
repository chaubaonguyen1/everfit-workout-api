import type { DateRange } from '../../common/utils';
import type { WeightUnit } from '../units/domain/weight-unit.registry';
import type { ExerciseRef } from '../exercises/exercises.repository';
import { presentSet } from '../workouts/domain/present-set';
import { ComparisonPeriods, computeChange } from './domain/comparison';
import {
  PersonalRecordResponse,
  PersonalRecordsComparisonResponse,
  PersonalRecordsResponse,
  PersonalRecordsSummary,
} from './dto/personal-records.response';
import type { RecordMetric, RecordRows, RecordSetRow } from './personal-records.repository';

export const NO_RECORDS_MESSAGE = 'No sets recorded for this exercise in the given range';
export const NO_RECORDS_IN_EITHER_PERIOD_MESSAGE =
  'No sets recorded for this exercise in either period';

export function toPersonalRecordsResponse(
  exercise: ExerciseRef,
  range: DateRange,
  rows: RecordRows,
  unit: WeightUnit,
): PersonalRecordsResponse {
  const records = toSummary(rows, unit);
  return {
    exercise: { id: exercise.id, name: exercise.name },
    unit,
    range: { from: range.from?.toISOString() ?? null, to: range.to?.toISOString() ?? null },
    records,
    ...(isEmpty(records) && { message: NO_RECORDS_MESSAGE }),
  };
}

export function toComparisonResponse(
  exercise: ExerciseRef,
  periods: ComparisonPeriods,
  current: RecordRows,
  previous: RecordRows,
  unit: WeightUnit,
): PersonalRecordsComparisonResponse {
  const now = toSummary(current, unit);
  const before = toSummary(previous, unit);
  return {
    exercise: { id: exercise.id, name: exercise.name },
    unit,
    period: periods.mode,
    current: {
      from: periods.current.from.toISOString(),
      to: periods.current.to.toISOString(),
      records: now,
    },
    previous: {
      from: periods.previous.from.toISOString(),
      to: periods.previous.to.toISOString(),
      records: before,
    },
    change: {
      maxWeight: computeChange(now.maxWeight?.value, before.maxWeight?.value),
      maxVolume: computeChange(now.maxVolume?.value, before.maxVolume?.value),
      bestEstimatedOneRepMax: computeChange(
        now.bestEstimatedOneRepMax?.value,
        before.bestEstimatedOneRepMax?.value,
      ),
    },
    ...(isEmpty(now) && isEmpty(before) && { message: NO_RECORDS_IN_EITHER_PERIOD_MESSAGE }),
  };
}

function toSummary(rows: RecordRows, unit: WeightUnit): PersonalRecordsSummary {
  return {
    maxWeight: toRecord(rows.weight, 'weight', unit),
    maxVolume: toRecord(rows.volume, 'volume', unit),
    bestEstimatedOneRepMax: toRecord(rows.e1rm, 'e1rm', unit),
  };
}

function toRecord(
  row: RecordSetRow | undefined,
  metric: RecordMetric,
  unit: WeightUnit,
): PersonalRecordResponse | null {
  if (!row) return null;
  const set = presentSet(row, unit);
  const value =
    metric === 'weight' ? set.weight : metric === 'volume' ? set.volume : set.estimatedOneRepMax;
  return {
    value,
    achievedAt: row.performedAt.toISOString(),
    entryId: row.entryId,
    set: { reps: set.reps, weight: set.weight },
  };
}

function isEmpty(summary: PersonalRecordsSummary): boolean {
  return !summary.maxWeight && !summary.maxVolume && !summary.bestEstimatedOneRepMax;
}
