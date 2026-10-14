import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCode } from '../../common/errors';
import { roundTo } from '../../common/utils';
import { fromKg, toKg } from './domain/weight-conversion';
import {
  CANONICAL_WEIGHT_UNIT,
  SUPPORTED_WEIGHT_UNITS,
  WeightUnit,
  isWeightUnit,
} from './domain/weight-unit.registry';

/** Decimal places used when presenting weights to clients. */
export const PRESENTATION_DECIMALS = 2;

export interface OriginalWeight {
  readonly weight: number;
  readonly unit: WeightUnit;
}

/**
 * Injectable facade over the pure unit functions: validates untrusted unit strings and
 * formats weights for output. Business code depends on this instead of the registry directly.
 */
@Injectable()
export class UnitConverterService {
  readonly canonicalUnit = CANONICAL_WEIGHT_UNIT;
  readonly supportedUnits = SUPPORTED_WEIGHT_UNITS;

  parseUnit(value: string, field = 'unit'): WeightUnit {
    if (isWeightUnit(value)) return value;
    throw new DomainError(ErrorCode.UNSUPPORTED_UNIT, `Unsupported weight unit "${value}"`, [
      { field, issue: `must be one of: ${this.supportedUnits.join(', ')}` },
    ]);
  }

  toKg(weight: number, unit: WeightUnit): number {
    return toKg(weight, unit);
  }

  /**
   * Weight to show the client in `unit`. When the set was logged in that same unit we return the
   * original number, so 225 lb never comes back as 224.99 after a kg round-trip.
   */
  present(weightKg: number, unit: WeightUnit, original?: OriginalWeight): number {
    const value = original?.unit === unit ? original.weight : fromKg(weightKg, unit);
    return roundTo(value, PRESENTATION_DECIMALS);
  }
}
