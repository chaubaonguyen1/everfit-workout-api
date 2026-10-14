import {
  isValidTimeZone,
  parseInstant,
  parseRangeEnd,
  timeZoneOffsetMs,
  toWallTime,
} from './date.util';

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

    describe('DST transitions (compatible disambiguation)', () => {
      it.each([
        // [input, zone, expected UTC, why]
        ['2026-03-08T02:30', 'America/New_York', '2026-03-08T07:30:00.000Z', 'gap → 03:30 EDT'],
        [
          '2026-11-01T01:30',
          'America/New_York',
          '2026-11-01T05:30:00.000Z',
          'overlap → earlier (EDT)',
        ],
        [
          '2026-09-06',
          'America/Santiago',
          '2026-09-06T04:00:00.000Z',
          'midnight gap stays on Sep 6',
        ],
        [
          '2026-03-29',
          'Atlantic/Azores',
          '2026-03-29T01:00:00.000Z',
          'midnight gap stays on Mar 29',
        ],
        [
          '2026-04-24',
          'Africa/Cairo',
          '2026-04-23T22:00:00.000Z',
          'positive-offset zone, gap at 00:00',
        ],
      ])('%s in %s → %s (%s)', (input, zone, expected) => {
        expect(iso(parseInstant(input, zone))).toBe(expected);
      });

      it('never moves a date-only input to the previous local day', () => {
        const zones = ['America/Santiago', 'Atlantic/Azores', 'America/Havana', 'America/New_York'];
        for (const zone of zones) {
          for (let day = 1; day <= 365; day++) {
            const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
            const local = toWallTime(parseInstant(date, zone), zone);
            const localDate = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
            expect(`${zone} ${localDate}`).toBe(`${zone} ${date}`);
          }
        }
      });
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

describe('supported instant range (what Postgres can round-trip)', () => {
  it('rejects instants before year 1 or after 9999 instead of failing in the database', () => {
    expect(() => parseInstant('9999-12-31T23:00:00-05:00')).toThrow(/between years 0001 and 9999/);
    expect(() => parseInstant('0001-01-01T00:00:00+01:00')).toThrow(/between years 0001 and 9999/);
  });

  it('clamps a range ending on 9999-12-31 to the last representable instant', () => {
    expect(iso(parseRangeEnd('9999-12-31'))).toBe('9999-12-31T23:59:59.999Z');
  });
});

describe('parseRangeEnd', () => {
  it('turns a date-only value into the start of the next local day (whole day included)', () => {
    expect(iso(parseRangeEnd('2026-10-14', 'Asia/Ho_Chi_Minh'))).toBe('2026-10-14T17:00:00.000Z');
  });

  it('rolls over month and year ends', () => {
    expect(iso(parseRangeEnd('2026-12-31'))).toBe('2027-01-01T00:00:00.000Z');
    expect(iso(parseRangeEnd('2028-02-28'))).toBe('2028-02-29T00:00:00.000Z');
  });

  it('uses date-times as given', () => {
    expect(iso(parseRangeEnd('2026-10-14T12:00:00Z'))).toBe('2026-10-14T12:00:00.000Z');
  });

  it('validates like parseInstant', () => {
    expect(() => parseRangeEnd('2026-02-30')).toThrow(/valid calendar/);
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
