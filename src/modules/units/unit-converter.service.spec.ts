import { DomainError, ErrorCode } from '../../common/errors';
import { UnitConverterService } from './unit-converter.service';

describe('UnitConverterService', () => {
  const service = new UnitConverterService();

  describe('parseUnit', () => {
    it('returns the typed unit for supported values', () => {
      expect(service.parseUnit('lb')).toBe('lb');
    });

    it('throws UNSUPPORTED_UNIT listing the supported units', () => {
      expect.assertions(3);
      const attempt = () => service.parseUnit('stone', 'entries[0].sets[0].unit');

      expect(attempt).toThrow(DomainError);
      try {
        attempt();
      } catch (error) {
        expect((error as DomainError).code).toBe(ErrorCode.UNSUPPORTED_UNIT);
        expect((error as DomainError).details).toEqual([
          { field: 'entries[0].sets[0].unit', issue: 'must be one of: kg, lb' },
        ]);
      }
    });
  });

  describe('present', () => {
    it('converts from kg and rounds to 2 decimals', () => {
      expect(service.present(100, 'lb')).toBe(220.46);
    });

    it('returns the original value when the requested unit matches the logged unit', () => {
      const weightKg = service.toKg(225, 'lb');

      expect(service.present(weightKg, 'lb', { weight: 225, unit: 'lb' })).toBe(225);
    });

    it('ignores the original value when units differ', () => {
      expect(service.present(102.0582, 'kg', { weight: 225, unit: 'lb' })).toBe(102.06);
    });
  });
});
