import { createHash } from 'node:crypto';

/**
 * Deterministic JSON: object keys are sorted recursively so semantically equal payloads
 * serialize identically regardless of key order (used to fingerprint idempotent requests).
 * Array order is significant and preserved; `undefined` properties are dropped like JSON.stringify.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

/** Short, stable fingerprint of a value (16 hex chars of SHA-256 over its canonical JSON). */
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}
