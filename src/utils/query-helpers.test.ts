import { describe, expect, it } from 'vitest';
import { buildSearchClause, escapeRegex, toDateRange, toUpdateOperators } from './query-helpers';

describe('escapeRegex', () => {
  it('escapes every regex metacharacter', () => {
    const input = '.*+?^${}()|[]\\';
    expect(new RegExp(escapeRegex(input)).test(input)).toBe(true);
  });

  it('leaves plain text untouched', () => {
    expect(escapeRegex('John Doe')).toBe('John Doe');
  });
});

describe('toDateRange', () => {
  it('returns undefined when no bounds are given', () => {
    expect(toDateRange()).toBeUndefined();
  });

  it('spans whole UTC days inclusively', () => {
    expect(toDateRange('2026-01-01', '2026-01-31')).toEqual({
      $gte: new Date('2026-01-01T00:00:00.000Z'),
      $lte: new Date('2026-01-31T23:59:59.999Z'),
    });
  });

  it('supports open-ended ranges', () => {
    expect(toDateRange('2026-01-01')).toEqual({ $gte: new Date('2026-01-01T00:00:00.000Z') });
    expect(toDateRange(undefined, '2026-01-01')).toEqual({
      $lte: new Date('2026-01-01T23:59:59.999Z'),
    });
  });
});

describe('toUpdateOperators', () => {
  it('splits defined values into $set and cleared values into $unset', () => {
    expect(toUpdateOperators({ name: 'A', email: undefined })).toEqual({
      $set: { name: 'A' },
      $unset: { email: '' },
    });
  });

  it('omits empty operators', () => {
    expect(toUpdateOperators({ name: 'A' })).toEqual({ $set: { name: 'A' } });
    expect(toUpdateOperators({ notes: undefined })).toEqual({ $unset: { notes: '' } });
  });
});

describe('buildSearchClause', () => {
  it('combines $text with anchored, case-insensitive, escaped prefix regexes', () => {
    const clause = buildSearchClause('  dr. a+ ', ['name', 'email']);
    expect(clause.$or[0]).toEqual({ $text: { $search: '"dr. a+"' } });
    const nameRegex = (clause.$or[1] as { name: RegExp }).name;
    expect(nameRegex.source).toBe('^dr\\. a\\+');
    expect(nameRegex.flags).toBe('i');
    expect(clause.$or).toHaveLength(3);
  });

  it('strips double quotes so users cannot break out of the phrase', () => {
    expect(buildSearchClause('a"b', ['name']).$or[0]).toEqual({ $text: { $search: '"ab"' } });
  });
});
