/**
 * Opaque keyset-pagination cursor: the sort key of the last item of a page.
 * Encoded as base64url JSON so clients treat it as a token, not something to construct.
 */
export interface KeysetCursor {
  readonly performedAt: Date;
  readonly id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CURSOR_LENGTH = 256;

export function encodeCursor(cursor: KeysetCursor): string {
  const payload = JSON.stringify({ p: cursor.performedAt.toISOString(), i: cursor.id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** @throws RangeError when the token is malformed or tampered with. */
export function decodeCursor(token: string): KeysetCursor {
  if (token.length === 0 || token.length > MAX_CURSOR_LENGTH) throw invalid();

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }

  if (typeof payload !== 'object' || payload === null) throw invalid();
  const { p, i } = payload as Record<string, unknown>;
  if (typeof p !== 'string' || typeof i !== 'string' || !UUID.test(i)) throw invalid();

  const performedAt = new Date(p);
  if (Number.isNaN(performedAt.getTime()) || performedAt.toISOString() !== p) throw invalid();
  return { performedAt, id: i.toLowerCase() };
}

function invalid(): RangeError {
  return new RangeError('cursor is invalid or expired; restart from the first page');
}
