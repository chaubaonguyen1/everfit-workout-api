import { WEIGHT_UNITS, WeightUnit } from './weight-unit.registry';

/** Full-precision conversion to kilograms (no rounding — this value is persisted). */
export function toKg(weight: number, unit: WeightUnit): number {
  return weight * WEIGHT_UNITS[unit].toKgFactor;
}

/** Full-precision conversion from kilograms; round only when presenting. */
export function fromKg(weightKg: number, unit: WeightUnit): number {
  return weightKg / WEIGHT_UNITS[unit].toKgFactor;
}

export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  return from === to ? weight : fromKg(toKg(weight, from), to);
}
