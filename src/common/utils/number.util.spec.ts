import { roundTo } from './number.util';

describe('roundTo', () => {
  it.each([
    [1.005, 2, 1.01],
    [45.359237, 2, 45.36],
    [99.99998, 2, 100],
    [2.5, 0, 3],
    [-2.5, 0, -3],
    [0.1 + 0.2, 2, 0.3],
  ])('roundTo(%p, %p) → %p', (value, decimals, expected) => {
    expect(roundTo(value, decimals)).toBe(expected);
  });

  it('defaults to 2 decimals', () => {
    expect(roundTo(1.23456)).toBe(1.23);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundTo(-0.0001, 2), 0)).toBe(true);
  });

  it('rejects NaN and Infinity instead of propagating them into responses', () => {
    expect(() => roundTo(Number.NaN)).toThrow(RangeError);
    expect(() => roundTo(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
