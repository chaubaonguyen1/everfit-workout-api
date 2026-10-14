interface WeightUnitDefinition {
  readonly name: string;
  /** Multiply a value in this unit by `toKgFactor` to get kilograms. */
  readonly toKgFactor: number;
}

/**
 * Single source of truth for supported weight units.
 * Adding a unit is one line here, e.g. `st: { name: 'stone', toKgFactor: 6.35029318 }` —
 * validation, conversion, API docs and error messages all derive from this map.
 */
export const WEIGHT_UNITS = {
  kg: { name: 'kilogram', toKgFactor: 1 },
  lb: { name: 'pound', toKgFactor: 0.45359237 },
} as const satisfies Record<string, WeightUnitDefinition>;

export type WeightUnit = keyof typeof WEIGHT_UNITS;

/** Unit used for normalized storage (`weight_kg`) and as the default output unit. */
export const CANONICAL_WEIGHT_UNIT: WeightUnit = 'kg';

export const SUPPORTED_WEIGHT_UNITS: readonly WeightUnit[] = Object.freeze(
  Object.keys(WEIGHT_UNITS) as WeightUnit[],
);

export function isWeightUnit(value: unknown): value is WeightUnit {
  return typeof value === 'string' && Object.hasOwn(WEIGHT_UNITS, value);
}
