/**
 * Rounds half away from zero to `decimals` places, avoiding classic float artefacts
 * (`roundTo(1.005, 2)` → 1.01, not 1). Use for presentation only — never before persisting.
 */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot round a non-finite number: ${value}`);
  }
  const factor = 10 ** decimals;
  // Nudge by a relative epsilon so values like 100.49999999999999 (really 100.5) round up.
  const rounded = Math.round(Math.abs(value) * factor * (1 + Number.EPSILON)) / factor;
  return rounded === 0 ? 0 : Math.sign(value) * rounded;
}
