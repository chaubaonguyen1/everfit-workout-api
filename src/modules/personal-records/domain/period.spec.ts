import { periodContaining, previousPeriod } from './period';

const at = (iso: string) => new Date(iso);
const range = (p: { from: Date; to: Date }) => [p.from.toISOString(), p.to.toISOString()];

describe('periodContaining', () => {
  it('month boundaries are local midnights in the given zone', () => {
    expect(
      range(periodContaining(at('2026-10-14T12:00:00Z'), 'month', 'Asia/Ho_Chi_Minh')),
    ).toEqual(['2026-09-30T17:00:00.000Z', '2026-10-31T17:00:00.000Z']);
  });

  it('uses the local date, not the UTC date, to pick the month', () => {
    // 2026-10-31T18:00Z is already Nov 1 in Ho Chi Minh City.
    const [from] = range(periodContaining(at('2026-10-31T18:00:00Z'), 'month', 'Asia/Ho_Chi_Minh'));
    expect(from).toBe('2026-10-31T17:00:00.000Z');
  });

  it('rolls over the year for December', () => {
    expect(range(periodContaining(at('2026-12-15T00:00:00Z'), 'month', 'UTC'))).toEqual([
      '2026-12-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ]);
  });

  it('ISO weeks start on Monday (Sunday belongs to the week before)', () => {
    // 2026-10-18 is a Sunday.
    expect(range(periodContaining(at('2026-10-18T10:00:00Z'), 'week', 'UTC'))).toEqual([
      '2026-10-12T00:00:00.000Z',
      '2026-10-19T00:00:00.000Z',
    ]);
    expect(range(periodContaining(at('2026-10-19T00:00:00Z'), 'week', 'UTC'))[0]).toBe(
      '2026-10-19T00:00:00.000Z',
    );
  });

  it('weeks spanning a month/year end', () => {
    expect(range(periodContaining(at('2027-01-01T00:00:00Z'), 'week', 'UTC'))).toEqual([
      '2026-12-28T00:00:00.000Z',
      '2027-01-04T00:00:00.000Z',
    ]);
  });

  it('handles DST: a week containing the change is 167 hours long in New York', () => {
    const week = periodContaining(at('2026-03-10T12:00:00Z'), 'week', 'America/New_York');

    expect(range(week)).toEqual(['2026-03-09T04:00:00.000Z', '2026-03-16T04:00:00.000Z']);
    const spring = periodContaining(at('2026-03-05T12:00:00Z'), 'week', 'America/New_York');
    expect((spring.to.getTime() - spring.from.getTime()) / 3_600_000).toBe(167);
  });
});

describe('previousPeriod', () => {
  it('previous month, including across a year boundary', () => {
    const jan = periodContaining(at('2027-01-10T00:00:00Z'), 'month', 'UTC');

    expect(range(previousPeriod(jan, 'month', 'UTC'))).toEqual([
      '2026-12-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ]);
  });

  it('previous month has its own length (March → February)', () => {
    const march = periodContaining(at('2028-03-15T00:00:00Z'), 'month', 'UTC');

    expect(range(previousPeriod(march, 'month', 'UTC'))).toEqual([
      '2028-02-01T00:00:00.000Z',
      '2028-03-01T00:00:00.000Z',
    ]);
  });

  it('previous week is contiguous with the current one', () => {
    const week = periodContaining(at('2026-10-14T00:00:00Z'), 'week', 'Asia/Ho_Chi_Minh');
    const previous = previousPeriod(week, 'week', 'Asia/Ho_Chi_Minh');

    expect(previous.to).toEqual(week.from);
    expect(previous.from.toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });
});
