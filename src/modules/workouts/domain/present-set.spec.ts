import { toKg } from '../../units/domain/weight-conversion';
import { computeSetMetrics } from './set-metrics';
import { StoredSet, presentSet } from './present-set';

function stored(reps: number, weight: number, unit: 'kg' | 'lb'): StoredSet {
  const weightKg = toKg(weight, unit);
  const metrics = computeSetMetrics(weightKg, reps);
  return {
    reps,
    weight,
    unit,
    weightKg,
    volumeKg: metrics.volumeKg,
    e1rmKg: metrics.estimatedOneRepMaxKg,
  };
}

describe('presentSet', () => {
  it('defaults to the logged unit and keeps logged values exact', () => {
    expect(presentSet(stored(5, 225, 'lb'))).toEqual({
      reps: 5,
      weight: 225,
      unit: 'lb',
      volume: 1125,
      estimatedOneRepMax: 262.5,
    });
  });

  it('converts weight, volume and 1RM consistently to another unit', () => {
    expect(presentSet(stored(5, 225, 'lb'), 'kg')).toEqual({
      reps: 5,
      weight: 102.06,
      unit: 'kg',
      volume: 510.29,
      estimatedOneRepMax: 119.07,
    });
  });

  it('round-trips kg → lb → kg without drift for kg-logged sets', () => {
    expect(presentSet(stored(3, 100, 'kg'), 'kg').weight).toBe(100);
    expect(presentSet(stored(3, 100, 'kg'), 'lb').weight).toBe(220.46);
  });
});
