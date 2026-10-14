import { Injectable } from '@nestjs/common';
import { DomainError, ErrorCode } from '../../common/errors';
import { toKg } from './domain/weight-conversion';
import { OriginalWeight, presentWeight } from './domain/weight-presentation';
import {
  CANONICAL_WEIGHT_UNIT,
  SUPPORTED_WEIGHT_UNITS,
  WeightUnit,
  isWeightUnit,
} from './domain/weight-unit.registry';

export { PRESENTATION_DECIMALS } from './domain/weight-presentation';
export type { OriginalWeight } from './domain/weight-presentation';

/**
 * Injectable facade over the pure unit functions: validates untrusted unit strings and
 * formats weights for output.
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

  present(weightKg: number, unit: WeightUnit, original?: OriginalWeight): number {
    return presentWeight(weightKg, unit, original);
  }
}
