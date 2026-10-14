import { ErrorDetail, ValidationError } from '../../../common/errors';
import { DEFAULT_TIME_ZONE, normalizeName, parseInstant } from '../../../common/utils';
import { toKg } from '../../units/domain/weight-conversion';
import { WeightUnit } from '../../units/domain/weight-unit.registry';
import { computeSetMetrics } from './set-metrics';

/** How far in the future a workout may be dated (tolerates client clock skew / time zones). */
export const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const EARLIEST_ALLOWED = Date.UTC(1900, 0, 1);
/** Matches `exercises.normalized_name VARCHAR(100)`. */
export const MAX_EXERCISE_NAME_LENGTH = 100;

export interface SetInput {
  readonly reps: number;
  readonly weight: number;
  readonly unit: WeightUnit;
}

export interface EntryInput {
  readonly date: string;
  readonly exerciseName: string;
  readonly sets: readonly SetInput[];
}

export interface PreparedSet extends SetInput {
  readonly setIndex: number;
  readonly weightKg: number;
  readonly volumeKg: number;
  readonly estimatedOneRepMaxKg: number;
}

export interface PreparedEntry {
  readonly performedAt: Date;
  readonly exercise: { readonly name: string; readonly normalizedName: string };
  readonly sets: readonly PreparedSet[];
}

export interface PrepareOptions {
  readonly timeZone?: string;
  readonly now: Date;
}

/**
 * Turns validated request entries into rows ready to persist: resolves each date to a UTC
 * instant (in the request's time zone), normalizes weights to kg and computes per-set metrics.
 * Collects every problem before failing so the client can fix the whole batch in one go.
 */
export function prepareEntries(
  entries: readonly EntryInput[],
  { timeZone = DEFAULT_TIME_ZONE, now }: PrepareOptions,
): PreparedEntry[] {
  const problems: ErrorDetail[] = [];
  const latestAllowed = now.getTime() + MAX_FUTURE_SKEW_MS;

  const prepared = entries.map((entry, i) => {
    const performedAt = resolveDate(entry.date, timeZone, `entries[${i}].date`, problems);
    if (performedAt && performedAt.getTime() > latestAllowed) {
      problems.push({
        field: `entries[${i}].date`,
        issue: 'must not be more than 24 hours in the future',
      });
    }
    if (performedAt && performedAt.getTime() < EARLIEST_ALLOWED) {
      problems.push({ field: `entries[${i}].date`, issue: 'must not be before 1900-01-01' });
    }

    const name = entry.exerciseName.trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeName(name);
    // Checked after normalization: NFKC + lowercasing can lengthen a string ('ﷺ' → 18 chars),
    // so the DTO's length check alone cannot guarantee it fits the column.
    if (normalizedName.length > MAX_EXERCISE_NAME_LENGTH) {
      problems.push({
        field: `entries[${i}].exerciseName`,
        issue: `must be at most ${MAX_EXERCISE_NAME_LENGTH} characters once normalized`,
      });
    }
    return {
      performedAt: performedAt ?? new Date(Number.NaN),
      exercise: { name, normalizedName },
      sets: entry.sets.map((set, setIndex) => prepareSet(set, setIndex)),
    };
  });

  if (problems.length > 0) throw new ValidationError('Request validation failed', problems);
  return prepared;
}

/** Distinct exercises referenced by a batch, sorted so concurrent batches lock rows in the same order. */
export function distinctExercises(
  entries: readonly PreparedEntry[],
): { readonly name: string; readonly normalizedName: string }[] {
  const byName = new Map(entries.map((e) => [e.exercise.normalizedName, e.exercise]));
  return [...byName.values()].sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

function prepareSet(set: SetInput, setIndex: number): PreparedSet {
  const weightKg = toKg(set.weight, set.unit);
  const metrics = computeSetMetrics(weightKg, set.reps);
  return {
    setIndex,
    reps: set.reps,
    weight: set.weight,
    unit: set.unit,
    weightKg,
    volumeKg: metrics.volumeKg,
    estimatedOneRepMaxKg: metrics.estimatedOneRepMaxKg,
  };
}

function resolveDate(
  value: string,
  timeZone: string,
  field: string,
  problems: ErrorDetail[],
): Date | undefined {
  try {
    return parseInstant(value, timeZone);
  } catch (error) {
    problems.push({ field, issue: error instanceof RangeError ? error.message : 'is invalid' });
    return undefined;
  }
}
