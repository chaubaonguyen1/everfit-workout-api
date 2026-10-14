import { convertWeight, fromKg, toKg } from './weight-conversion';
import { SUPPORTED_WEIGHT_UNITS, isWeightUnit } from './weight-unit.registry';

describe('weight conversion', () => {
  it('uses the exact international pound definition (1 lb = 0.45359237 kg)', () => {
    expect(toKg(1, 'lb')).toBe(0.45359237);
    expect(toKg(100, 'lb')).toBeCloseTo(45.359237, 9);
  });

  it('is the identity for kg', () => {
    expect(toKg(82.5, 'kg')).toBe(82.5);
    expect(fromKg(82.5, 'kg')).toBe(82.5);
  });

  it('round-trips every supported unit without meaningful drift', () => {
    for (const unit of SUPPORTED_WEIGHT_UNITS) {
      expect(fromKg(toKg(137.5, unit), unit)).toBeCloseTo(137.5, 9);
    }
  });

  it('converts between non-canonical units through kg', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.462262, 6);
    expect(convertWeight(225, 'lb', 'lb')).toBe(225);
  });

  it('handles zero (bodyweight / empty bar logged as 0)', () => {
    expect(toKg(0, 'lb')).toBe(0);
  });
});

describe('isWeightUnit', () => {
  it.each(['kg', 'lb'])('accepts %p', (unit) => {
    expect(isWeightUnit(unit)).toBe(true);
  });

  it.each(['KG', 'lbs', 'stone', '', 'toString', '__proto__', 1, null, undefined])(
    'rejects %p',
    (unit) => {
      expect(isWeightUnit(unit)).toBe(false);
    },
  );
});
