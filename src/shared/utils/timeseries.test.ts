import { describe, expect, it } from 'vitest';
import { addInterval, defaultRange, fillTimeseries, toDateKey, truncateUtc } from './timeseries';

const d = (iso: string) => new Date(`${iso}T12:34:56Z`);

describe('truncateUtc', () => {
  it('truncates to the start of the day', () => {
    expect(toDateKey(truncateUtc(d('2026-03-15'), 'day'))).toBe('2026-03-15');
  });

  it('truncates to Monday for weeks', () => {
    // 2026-03-15 is a Sunday → week starts Monday 2026-03-09
    expect(toDateKey(truncateUtc(d('2026-03-15'), 'week'))).toBe('2026-03-09');
    // A Monday stays on itself
    expect(toDateKey(truncateUtc(d('2026-03-09'), 'week'))).toBe('2026-03-09');
  });

  it('truncates to the first of the month', () => {
    expect(toDateKey(truncateUtc(d('2026-03-15'), 'month'))).toBe('2026-03-01');
  });
});

describe('addInterval', () => {
  it('handles month rollover across years', () => {
    expect(toDateKey(addInterval(new Date('2025-12-01T00:00:00Z'), 'month'))).toBe('2026-01-01');
  });

  it('supports negative amounts', () => {
    expect(toDateKey(addInterval(new Date('2026-03-01T00:00:00Z'), 'month', -3))).toBe(
      '2025-12-01',
    );
  });
});

describe('defaultRange', () => {
  it('covers 12 months including the current one', () => {
    const { from } = defaultRange('month', d('2026-11-18'));
    expect(toDateKey(from)).toBe('2025-12-01');
  });

  it('covers 30 days for the day interval', () => {
    const { from } = defaultRange('day', d('2026-11-18'));
    expect(toDateKey(from)).toBe('2026-10-20');
  });
});

describe('fillTimeseries', () => {
  it('fills missing buckets with zero and keeps existing values', () => {
    const result = fillTimeseries(
      [
        { date: '2026-01-01', patients: 5 },
        { date: '2026-03-01', patients: 2 },
      ],
      d('2026-01-10'),
      d('2026-04-02'),
      'month',
    );
    expect(result).toEqual([
      { date: '2026-01-01', patients: 5 },
      { date: '2026-02-01', patients: 0 },
      { date: '2026-03-01', patients: 2 },
      { date: '2026-04-01', patients: 0 },
    ]);
  });

  it('returns a single bucket when from and to fall in the same bucket', () => {
    expect(fillTimeseries([], d('2026-03-10'), d('2026-03-12'), 'week')).toEqual([
      { date: '2026-03-09', patients: 0 },
    ]);
  });
});
