import { roundTo } from '../../../common/utils';
import { fromKg } from './weight-conversion';
import { WeightUnit } from './weight-unit.registry';

/** Decimal places used when presenting weights to clients. */
export const PRESENTATION_DECIMALS = 2;

export interface OriginalWeight {
  readonly weight: number;
  readonly unit: WeightUnit;
}

/**
 * Weight to show in `unit`, rounded for display. When the value was logged in that same unit,
 * the original number is used, so 225 lb never comes back as 224.99 after a kg round-trip.
 */
export function presentWeight(
  weightKg: number,
  unit: WeightUnit,
  original?: OriginalWeight,
): number {
  const value = original?.unit === unit ? original.weight : fromKg(weightKg, unit);
  return roundTo(value, PRESENTATION_DECIMALS);
}
