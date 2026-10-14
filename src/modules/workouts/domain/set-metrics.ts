/**
 * Per-set training metrics. Computed once at write time and stored alongside the set, so PR
 * queries are plain indexed `ORDER BY … LIMIT 1` lookups instead of scans over computed values.
 * The formulas are linear in weight, so they hold in any unit: callers pass kg when storing and
 * the logged unit when presenting a set in the unit it was logged in.
 */

export interface SetMetrics {
  readonly volumeKg: number;
  readonly estimatedOneRepMaxKg: number;
}

/** Volume of a single set: reps × weight. */
export function setVolume(weight: number, reps: number): number {
  assertValidSet(weight, reps);
  return weight * reps;
}

/**
 * Estimated one-rep max using the Epley formula, as specified: weight × (1 + reps / 30).
 * Note: applied literally for every rep count, so a true single (reps = 1) yields
 * weight × 1.0333 rather than the weight itself.
 */
export function epleyOneRepMax(weight: number, reps: number): number {
  assertValidSet(weight, reps);
  return weight * (1 + reps / 30);
}

export function computeSetMetrics(weightKg: number, reps: number): SetMetrics {
  return {
    volumeKg: setVolume(weightKg, reps),
    estimatedOneRepMaxKg: epleyOneRepMax(weightKg, reps),
  };
}

function assertValidSet(weight: number, reps: number): void {
  if (!Number.isFinite(weight) || weight < 0) {
    throw new RangeError(`weight must be a finite number >= 0, got ${weight}`);
  }
  if (!Number.isInteger(reps) || reps < 1) {
    throw new RangeError(`reps must be an integer >= 1, got ${reps}`);
  }
}
