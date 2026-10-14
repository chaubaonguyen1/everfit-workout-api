import { stableStringify } from './json.util';

describe('stableStringify', () => {
  it('is independent of object key order, at any depth', () => {
    const a = { b: 1, a: { d: [1, 2], c: 'x' } };
    const b = { a: { c: 'x', d: [1, 2] }, b: 1 };

    expect(stableStringify(a)).toBe(stableStringify(b));
    expect(stableStringify(a)).toBe('{"a":{"c":"x","d":[1,2]},"b":1}');
  });

  it('treats array order as significant', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('drops undefined properties (so an omitted optional field equals an absent one)', () => {
    expect(stableStringify({ a: 1, tz: undefined })).toBe(stableStringify({ a: 1 }));
  });

  it('serializes dates as ISO strings', () => {
    expect(stableStringify({ at: new Date('2026-10-14T00:00:00Z') })).toBe(
      '{"at":"2026-10-14T00:00:00.000Z"}',
    );
  });
});
