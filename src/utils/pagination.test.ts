import { describe, expect, it } from 'vitest';
import { buildMeta, buildSort, getSkip } from './pagination';

describe('getSkip', () => {
  it.each([
    [1, 10, 0],
    [2, 10, 10],
    [5, 25, 100],
  ])('page %i with limit %i skips %i', (page, limit, expected) => {
    expect(getSkip(page, limit)).toBe(expected);
  });
});

describe('buildMeta', () => {
  it('computes total pages', () => {
    expect(buildMeta(1, 10, 95)).toEqual({ page: 1, limit: 10, total: 95, totalPages: 10 });
  });

  it('returns 0 pages for an empty result', () => {
    expect(buildMeta(1, 10, 0).totalPages).toBe(0);
  });
});

describe('buildSort', () => {
  it('adds _id as a tiebreaker in the same direction', () => {
    expect(buildSort('createdAt', 'desc')).toEqual({ createdAt: -1, _id: -1 });
    expect(buildSort('name', 'asc')).toEqual({ name: 1, _id: 1 });
  });

  it('does not duplicate _id', () => {
    expect(buildSort('_id', 'asc')).toEqual({ _id: 1 });
  });
});
