import { decodeCursor, encodeCursor } from './cursor.util';

describe('cursor', () => {
  const cursor = {
    performedAt: new Date('2026-10-14T07:30:00.123Z'),
    id: '0b1f6c3e-8a2d-4f7e-9c1a-2b3c4d5e6f70',
  };

  it('round-trips the sort key with millisecond precision', () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('is URL-safe', () => {
    expect(encodeCursor(cursor)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

  it.each([
    ['empty', ''],
    ['not base64 json', 'definitely-not-a-cursor'],
    ['non-object payload', b64(42)],
    ['missing id', b64({ p: '2026-10-14T07:30:00.000Z' })],
    ['id not a uuid', b64({ p: '2026-10-14T07:30:00.000Z', i: "1' OR 1=1" })],
    ['invalid date', b64({ p: '2026-13-45', i: cursor.id })],
    ['non-canonical date', b64({ p: '2026-10-14', i: cursor.id })],
    ['oversized token', 'a'.repeat(300)],
  ])('rejects %s', (_label, token) => {
    expect(() => decodeCursor(token)).toThrow(/cursor is invalid/);
  });
});
