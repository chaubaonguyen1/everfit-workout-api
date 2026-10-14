/**
 * Per-set training metrics. Computed once at write time and stored alongside the set, so PR
 * queries are plain indexed `ORDER BY … LIMIT 1` lookups instead of scans over computed values.
 * All inputs/outputs are in kilograms.
 */

export interface SetMetrics {
  readonly volumeKg: number;
  readonly estimatedOneRepMaxKg: number;
}

/** Volume of a single set: reps × weight. */
export function setVolume(weightKg: number, reps: number): number {
  assertValidSet(weightKg, reps);
  return weightKg * reps;
}

/**
 * Estimated one-rep max using the Epley formula, as specified: weight × (1 + reps / 30).
 * Note: applied literally for every rep count, so a true single (reps = 1) yields
 * weight × 1.0333 rather than the weight itself.
 */
export function epleyOneRepMax(weightKg: number, reps: number): number {
  assertValidSet(weightKg, reps);
  return weightKg * (1 + reps / 30);
}

export function computeSetMetrics(weightKg: number, reps: number): SetMetrics {
  return {
    volumeKg: setVolume(weightKg, reps),
    estimatedOneRepMaxKg: epleyOneRepMax(weightKg, reps),
  };
}

function assertValidSet(weightKg: number, reps: number): void {
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new RangeError(`weight must be a finite number >= 0, got ${weightKg}`);
  }
  if (!Number.isInteger(reps) || reps < 1) {
    throw new RangeError(`reps must be an integer >= 1, got ${reps}`);
  }
}
