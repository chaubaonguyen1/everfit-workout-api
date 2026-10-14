/**
 * Canonical form used for identity/lookup of free-text names (e.g. exercise names), so that
 * "Bench  Press", " bench press" and "BENCH PRESS" resolve to the same record.
 */
export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Escapes `%`, `_` and `\` so user input is matched literally inside a SQL LIKE/ILIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
