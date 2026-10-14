import type { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './validation-error.helper';

const node = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({ property, constraints, children });

describe('flattenValidationErrors', () => {
  it('returns top-level constraint messages with the property as field', () => {
    const result = flattenValidationErrors([
      node('date', { isDateString: 'date must be ISO-8601' }),
    ]);

    expect(result).toEqual([{ field: 'date', issue: 'date must be ISO-8601' }]);
  });

  it('builds bracket paths for array indices and dot paths for nested objects', () => {
    const tree = node('entries', undefined, [
      node('0', undefined, [
        node('sets', undefined, [
          node('1', undefined, [node('weight', { min: 'weight must be >= 0' })]),
        ]),
      ]),
    ]);

    expect(flattenValidationErrors([tree])).toEqual([
      { field: 'entries[0].sets[1].weight', issue: 'weight must be >= 0' },
    ]);
  });

  it('keeps every constraint when a field violates several rules', () => {
    const result = flattenValidationErrors([node('reps', { isInt: 'not int', min: 'too small' })]);

    expect(result.map((d) => d.issue)).toEqual(['not int', 'too small']);
  });
});
