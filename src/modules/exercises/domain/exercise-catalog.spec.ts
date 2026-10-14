import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseExerciseCatalog } from './exercise-catalog';

const valid = {
  muscleGroups: ['chest', 'triceps', 'shoulders'],
  exercises: [{ name: '  Bench   Press ', muscleGroups: ['chest', 'triceps', 'chest'] }],
};

describe('parseExerciseCatalog', () => {
  it('normalizes names and de-duplicates muscle groups', () => {
    expect(parseExerciseCatalog(valid).exercises).toEqual([
      { name: 'Bench Press', normalizedName: 'bench press', muscleGroups: ['chest', 'triceps'] },
    ]);
  });

  it('rejects exercises whose names collide after normalization', () => {
    const catalog = {
      ...valid,
      exercises: [
        { name: 'Bench Press', muscleGroups: ['chest'] },
        { name: 'bench  press', muscleGroups: ['chest'] },
      ],
    };

    expect(() => parseExerciseCatalog(catalog)).toThrow(/duplicates exercises\[0\]/);
  });

  it('rejects muscle groups that are not declared (typo protection)', () => {
    const catalog = { ...valid, exercises: [{ name: 'Fly', muscleGroups: ['chets'] }] };

    expect(() => parseExerciseCatalog(catalog)).toThrow(/unknown values: chets/);
  });

  it('reports every problem at once', () => {
    const catalog = {
      muscleGroups: ['Chest'],
      exercises: [{ name: '', muscleGroups: [] }, { nope: true }],
    };

    expect(() => parseExerciseCatalog(catalog)).toThrow(
      /lowercase snake_case[\s\S]*exercises\[0\]\.name[\s\S]*exercises\[1\] must be/,
    );
  });

  it('rejects a non-object root', () => {
    expect(() => parseExerciseCatalog([])).toThrow(/must be a JSON object/);
  });

  it('accepts the catalog shipped in config/', () => {
    const file = join(__dirname, '../../../../config/exercise-catalog.json');
    const catalog = parseExerciseCatalog(JSON.parse(readFileSync(file, 'utf8')));

    expect(catalog.exercises.length).toBeGreaterThan(20);
  });
});
