import type { ValidationError as ClassValidatorError } from 'class-validator';
import { ErrorDetail } from '../errors';

/**
 * Flattens class-validator's nested error tree into a flat list with readable paths,
 * e.g. `entries[0].sets[1].weight: weight must not be less than 0`.
 */
export function flattenValidationErrors(
  errors: readonly ClassValidatorError[],
  parentPath = '',
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const path = joinPath(parentPath, error.property);
    const own = Object.values(error.constraints ?? {}).map((issue) => ({ field: path, issue }));
    const nested = flattenValidationErrors(error.children ?? [], path);
    return [...own, ...nested];
  });
}

function joinPath(parent: string, property: string): string {
  if (/^\d+$/.test(property)) return `${parent}[${property}]`;
  return parent ? `${parent}.${property}` : property;
}
