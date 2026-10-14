import { escapeLike, normalizeName } from './string.util';

describe('normalizeName', () => {
  it.each([
    ['Bench Press', 'bench press'],
    ['  bench   press  ', 'bench press'],
    ['BENCH\tPRESS', 'bench press'],
    ['Ｂｅｎｃｈ Press', 'bench press'], // full-width characters (NFKC)
  ])('normalizes %p → %p', (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });
});

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('100%_squat\\')).toBe('100\\%\\_squat\\\\');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLike('bench press')).toBe('bench press');
  });
});
