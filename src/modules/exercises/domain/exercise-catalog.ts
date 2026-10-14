import { normalizeName } from '../../../common/utils';

export interface CatalogExercise {
  readonly name: string;
  readonly normalizedName: string;
  readonly muscleGroups: readonly string[];
}

export interface ExerciseCatalog {
  readonly muscleGroups: readonly string[];
  readonly exercises: readonly CatalogExercise[];
}

const MAX_NAME_LENGTH = 100;

/**
 * Parses and validates the raw catalog JSON. Collects every problem before failing so a bad
 * edit to the config file is fixed in one go, and the app refuses to boot on an invalid catalog.
 */
export function parseExerciseCatalog(raw: unknown): ExerciseCatalog {
  const problems: string[] = [];
  const root = isRecord(raw) ? raw : {};
  if (!isRecord(raw)) problems.push('catalog must be a JSON object');

  const muscleGroups = parseMuscleGroupList(root.muscleGroups, problems);
  const known = new Set(muscleGroups);
  const exercises: CatalogExercise[] = [];
  const seen = new Map<string, number>();

  if (!Array.isArray(root.exercises)) {
    problems.push('"exercises" must be an array');
  } else {
    root.exercises.forEach((item, index) => {
      const at = `exercises[${index}]`;
      if (!isRecord(item) || typeof item.name !== 'string' || !Array.isArray(item.muscleGroups)) {
        problems.push(`${at} must be { name: string, muscleGroups: string[] }`);
        return;
      }

      const name = item.name.trim().replace(/\s+/g, ' ');
      const normalizedName = normalizeName(name);
      if (normalizedName.length === 0 || normalizedName.length > MAX_NAME_LENGTH) {
        problems.push(`${at}.name must be 1-${MAX_NAME_LENGTH} characters`);
        return;
      }

      const duplicateOf = seen.get(normalizedName);
      if (duplicateOf !== undefined) {
        problems.push(`${at}.name "${name}" duplicates exercises[${duplicateOf}]`);
        return;
      }
      seen.set(normalizedName, index);

      const unknown = item.muscleGroups.filter((g) => typeof g !== 'string' || !known.has(g));
      if (unknown.length > 0) {
        problems.push(`${at}.muscleGroups has unknown values: ${unknown.join(', ')}`);
        return;
      }

      exercises.push({
        name,
        normalizedName,
        muscleGroups: [...new Set(item.muscleGroups as string[])],
      });
    });
  }

  if (problems.length > 0) {
    throw new Error(`Invalid exercise catalog:\n  - ${problems.join('\n  - ')}`);
  }
  return { muscleGroups, exercises };
}

function parseMuscleGroupList(value: unknown, problems: string[]): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push('"muscleGroups" must be a non-empty array of strings');
    return [];
  }
  const invalid = value.filter((g) => typeof g !== 'string' || !/^[a-z][a-z_]*$/.test(g));
  if (invalid.length > 0) {
    problems.push(`"muscleGroups" entries must be lowercase snake_case: ${invalid.join(', ')}`);
  }
  return value.filter((g): g is string => typeof g === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
