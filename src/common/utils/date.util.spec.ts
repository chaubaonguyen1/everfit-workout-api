import { isValidTimeZone, parseInstant, timeZoneOffsetMs, toWallTime } from './date.util';

const iso = (d: Date) => d.toISOString();

describe('parseInstant', () => {
  describe('inputs with an explicit offset are absolute (time zone ignored)', () => {
    it.each([
      ['2026-10-14T07:30:00Z', '2026-10-14T07:30:00.000Z'],
      ['2026-10-14T07:30:00+07:00', '2026-10-14T00:30:00.000Z'],
      ['2026-10-14T07:30:00.5-05:30', '2026-10-14T13:00:00.500Z'],
      ['2026-10-14T07:30Z', '2026-10-14T07:30:00.000Z'],
    ])('%s → %s', (input, expected) => {
      expect(iso(parseInstant(input, 'Asia/Tokyo'))).toBe(expected);
    });
  });

  describe('inputs without an offset are wall-clock times in the given zone', () => {
    it('date-only = start of that day in the zone', () => {
      expect(iso(parseInstant('2026-10-14', 'Asia/Ho_Chi_Minh'))).toBe('2026-10-13T17:00:00.000Z');
    });

    it('defaults to UTC when no zone is given', () => {
      expect(iso(parseInstant('2026-10-14'))).toBe('2026-10-14T00:00:00.000Z');
      expect(iso(parseInstant('2026-10-14T07:30'))).toBe('2026-10-14T07:30:00.000Z');
    });

    it('applies the DST offset in effect on that date (New York summer vs winter)', () => {
      expect(iso(parseInstant('2026-07-01T09:00', 'America/New_York'))).toBe(
        '2026-07-01T13:00:00.000Z',
      );
      expect(iso(parseInstant('2026-12-01T09:00', 'America/New_York'))).toBe(
        '2026-12-01T14:00:00.000Z',
      );
    });

    it('resolves times right after a DST change correctly', () => {
      // New York switched to EDT (-4) at 2026-03-08 02:00 local.
      expect(iso(parseInstant('2026-03-08T03:30', 'America/New_York'))).toBe(
        '2026-03-08T07:30:00.000Z',
      );
    });
  });

  describe('rejects invalid input', () => {
    it.each([
      ['2026-02-30', /valid calendar/],
      ['2026-13-01', /valid calendar/],
      ['2026-10-14T24:00', /valid calendar/],
      ['14/10/2026', /ISO-8601/],
      ['2026-10-14 07:30', /ISO-8601/],
      ['', /ISO-8601/],
      ['2026-10-14T07:30+15:00', /offset/],
    ])('%p', (input, message) => {
      expect(() => parseInstant(input)).toThrow(message);
    });

    it('rejects unknown time zones', () => {
      expect(() => parseInstant('2026-10-14', 'Mars/Olympus')).toThrow(/Unknown time zone/);
    });
  });
});

describe('time zone helpers', () => {
  it('isValidTimeZone', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });

  it('timeZoneOffsetMs returns the offset at that instant', () => {
    expect(timeZoneOffsetMs(new Date('2026-10-14T00:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe(
      7 * 3600_000,
    );
    expect(timeZoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(
      -5 * 3600_000,
    );
  });

  it('toWallTime gives the local calendar fields', () => {
    expect(toWallTime(new Date('2026-10-31T18:30:00Z'), 'Asia/Ho_Chi_Minh')).toMatchObject({
      year: 2026,
      month: 11,
      day: 1,
      hour: 1,
      minute: 30,
    });
  });
});
