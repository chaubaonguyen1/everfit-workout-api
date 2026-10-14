import { computeSetMetrics, epleyOneRepMax, setVolume } from './set-metrics';

describe('epleyOneRepMax', () => {
  it.each([
    // weight, reps, expected 1RM
    [100, 10, 133.3333],
    [100, 5, 116.6667],
    [140, 3, 154],
    [100, 30, 200],
  ])('%p kg × %p reps → %p kg', (weight, reps, expected) => {
    expect(epleyOneRepMax(weight, reps)).toBeCloseTo(expected, 4);
  });

  it('applies the formula literally for a single rep (spec-mandated)', () => {
    expect(epleyOneRepMax(100, 1)).toBeCloseTo(103.3333, 4);
  });

  it('ranks a heavier low-rep set vs a lighter high-rep set by estimated strength', () => {
    // 120×3 (≈132) is a better 1RM estimate than 100×8 (≈126.7) despite lower volume.
    expect(epleyOneRepMax(120, 3)).toBeGreaterThan(epleyOneRepMax(100, 8));
    expect(setVolume(120, 3)).toBeLessThan(setVolume(100, 8));
  });

  it('returns 0 for a zero-weight set', () => {
    expect(epleyOneRepMax(0, 12)).toBe(0);
  });
});

describe('setVolume', () => {
  it('is reps × weight', () => {
    expect(setVolume(82.5, 8)).toBe(660);
  });
});

describe('input guards', () => {
  it.each([
    [-1, 5],
    [Number.NaN, 5],
    [Number.POSITIVE_INFINITY, 5],
    [100, 0],
    [100, -3],
    [100, 2.5],
  ])('rejects weight=%p reps=%p', (weight, reps) => {
    expect(() => computeSetMetrics(weight, reps)).toThrow(RangeError);
  });
});

describe('computeSetMetrics', () => {
  it('returns both metrics for a set', () => {
    expect(computeSetMetrics(100, 5)).toEqual({
      volumeKg: 500,
      estimatedOneRepMaxKg: expect.closeTo(116.6667, 4),
    });
  });
});
