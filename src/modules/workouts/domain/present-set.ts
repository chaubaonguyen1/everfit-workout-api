import { presentWeight } from '../../units/domain/weight-presentation';
import { WeightUnit } from '../../units/domain/weight-unit.registry';
import { epleyOneRepMax, setVolume } from './set-metrics';

/** A persisted set: as logged plus its normalized kg metrics. */
export interface StoredSet {
  readonly reps: number;
  readonly weight: number;
  readonly unit: WeightUnit;
  readonly weightKg: number;
  readonly volumeKg: number;
  readonly e1rmKg: number;
}

export interface PresentedSet {
  readonly reps: number;
  readonly weight: number;
  readonly unit: WeightUnit;
  readonly volume: number;
  readonly estimatedOneRepMax: number;
}

/**
 * A set expressed in `unit` (default: the unit it was logged in). In the logged unit every value
 * is derived from the original weight; otherwise from the stored kg values.
 */
export function presentSet(set: StoredSet, unit: WeightUnit = set.unit): PresentedSet {
  const original = (value: number) => ({ weight: value, unit: set.unit });
  return {
    reps: set.reps,
    weight: presentWeight(set.weightKg, unit, original(set.weight)),
    unit,
    volume: presentWeight(set.volumeKg, unit, original(setVolume(set.weight, set.reps))),
    estimatedOneRepMax: presentWeight(
      set.e1rmKg,
      unit,
      original(epleyOneRepMax(set.weight, set.reps)),
    ),
  };
}
