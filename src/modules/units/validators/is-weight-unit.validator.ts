import { ValidateBy, ValidationOptions } from 'class-validator';
import { SUPPORTED_WEIGHT_UNITS, isWeightUnit } from '../domain/weight-unit.registry';

/** DTO validator backed by the unit registry, so a new unit is accepted without touching DTOs. */
export function IsWeightUnit(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isWeightUnit',
      validator: {
        validate: (value: unknown) => isWeightUnit(value),
        defaultMessage: (args) =>
          `${args?.property ?? 'unit'} must be one of: ${SUPPORTED_WEIGHT_UNITS.join(', ')}`,
      },
    },
    options,
  );
}
