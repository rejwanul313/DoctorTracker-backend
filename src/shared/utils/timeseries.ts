import type { StatsInterval } from '../constants';
import type { TimeseriesPointDTO } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the UTC bucket containing `date` (weeks start on Monday, matching Mongo `$dateTrunc`). */
export function truncateUtc(date: Date, interval: StatsInterval): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  switch (interval) {
    case 'day':
      return new Date(Date.UTC(y, m, d));
    case 'week': {
      const daysSinceMonday = (date.getUTCDay() + 6) % 7;
      return new Date(Date.UTC(y, m, d) - daysSinceMonday * DAY_MS);
    }
    case 'month':
      return new Date(Date.UTC(y, m, 1));
  }
}

export function addInterval(date: Date, interval: StatsInterval, amount = 1): Date {
  switch (interval) {
    case 'day':
      return new Date(date.getTime() + amount * DAY_MS);
    case 'week':
      return new Date(date.getTime() + amount * 7 * DAY_MS);
    case 'month':
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
  }
}

export const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

/** Default look-back window per interval: 30 days, 12 weeks or 12 months (including the current bucket). */
export function defaultRange(interval: StatsInterval, now = new Date()): { from: Date; to: Date } {
  const span = interval === 'day' ? 30 : 12;
  const from = addInterval(truncateUtc(now, interval), interval, -(span - 1));
  return { from, to: now };
}

/**
 * Returns one point per bucket between `from` and `to` (inclusive), using 0 for buckets
 * with no data so charts show gaps as real zeros instead of interpolating across them.
 */
export function fillTimeseries(
  points: TimeseriesPointDTO[],
  from: Date,
  to: Date,
  interval: StatsInterval,
): TimeseriesPointDTO[] {
  const byDate = new Map(points.map((p) => [p.date, p.patients]));
  const filled: TimeseriesPointDTO[] = [];
  const end = truncateUtc(to, interval).getTime();

  for (
    let cursor = truncateUtc(from, interval);
    cursor.getTime() <= end;
    cursor = addInterval(cursor, interval)
  ) {
    const key = toDateKey(cursor);
    filled.push({ date: key, patients: byDate.get(key) ?? 0 });
  }
  return filled;
}
