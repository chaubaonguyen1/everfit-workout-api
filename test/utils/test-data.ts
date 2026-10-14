import { randomUUID } from 'node:crypto';

/**
 * Each test uses its own user id instead of truncating shared tables, so suites stay independent
 * (and can run against a DB that already has data) without cleanup ordering problems.
 */
export function newUserId(prefix = 'test'): string {
  return `${prefix}-${randomUUID()}`;
}

/** Unique exercise name so tests that create exercises don't collide with the catalog or each other. */
export function uniqueExerciseName(base = 'Test Exercise'): string {
  return `${base} ${randomUUID().slice(0, 8)}`;
}
