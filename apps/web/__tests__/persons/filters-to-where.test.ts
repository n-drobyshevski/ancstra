import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { buildPersonsWhere } from '../../lib/persons/filters-to-where';
import type { PersonsFilters } from '../../lib/persons/search-params';

const baseFilters: PersonsFilters = {
  q: '', sex: [], living: [], validation: [],
  bornFrom: null, bornTo: null, diedFrom: null, diedTo: null,
  place: '', placeScope: 'birth', citations: 'any',
  hasProposals: false, complGte: null,
  sort: 'edited', dir: 'desc', page: 1, size: 20, hide: [],
};

function debugSql(s: ReturnType<typeof sql>): string {
  return JSON.stringify(s, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
}

describe('buildPersonsWhere', () => {
  it('returns no conditions for default filters', () => {
    expect(buildPersonsWhere(baseFilters)).toHaveLength(0);
  });

  it('adds sex IN when sex non-empty and not all 3', () => {
    const c = buildPersonsWhere({ ...baseFilters, sex: ['M', 'F'] });
    expect(c).toHaveLength(1);
  });

  it('adds no condition when all three sex values selected', () => {
    expect(buildPersonsWhere({ ...baseFilters, sex: ['M', 'F', 'U'] })).toHaveLength(0);
  });

  it('adds is_living condition for single living value', () => {
    expect(buildPersonsWhere({ ...baseFilters, living: ['alive'] })).toHaveLength(1);
    expect(buildPersonsWhere({ ...baseFilters, living: ['alive', 'deceased'] })).toHaveLength(0);
  });

  it('adds validation condition for single value', () => {
    expect(buildPersonsWhere({ ...baseFilters, validation: ['proposed'] })).toHaveLength(1);
  });

  it('adds two conditions for born range with both bounds', () => {
    expect(buildPersonsWhere({ ...baseFilters, bornFrom: 1900, bornTo: 1950 })).toHaveLength(2);
  });

  it('adds bornFrom only with no upper bound', () => {
    expect(buildPersonsWhere({ ...baseFilters, bornFrom: 1900 })).toHaveLength(1);
  });

  it('adds died_sort range similarly', () => {
    expect(buildPersonsWhere({ ...baseFilters, diedFrom: 1900, diedTo: 1950 })).toHaveLength(2);
  });

  it('adds place EXISTS subquery for birth scope', () => {
    const c = buildPersonsWhere({ ...baseFilters, place: 'Chicago', placeScope: 'birth' });
    expect(c).toHaveLength(1);
    expect(debugSql(c[0])).toContain('Chicago');
  });

  it('adds place EXISTS without event_type filter for any scope', () => {
    expect(buildPersonsWhere({ ...baseFilters, place: 'Chicago', placeScope: 'any' })).toHaveLength(1);
  });

  it('adds sources_count condition for citations gte1/none/gte3', () => {
    expect(buildPersonsWhere({ ...baseFilters, citations: 'gte1' })).toHaveLength(1);
    expect(buildPersonsWhere({ ...baseFilters, citations: 'none' })).toHaveLength(1);
    expect(buildPersonsWhere({ ...baseFilters, citations: 'gte3' })).toHaveLength(1);
  });

  it('adds no condition for citations any', () => {
    expect(buildPersonsWhere({ ...baseFilters, citations: 'any' })).toHaveLength(0);
  });

  it('adds completeness condition when complGte set', () => {
    expect(buildPersonsWhere({ ...baseFilters, complGte: 60 })).toHaveLength(1);
  });

  it('adds proposed_relationships EXISTS when hasProposals=true', () => {
    expect(buildPersonsWhere({ ...baseFilters, hasProposals: true })).toHaveLength(1);
  });

  it('adds id IN restrictedIds when provided non-empty', () => {
    expect(buildPersonsWhere(baseFilters, ['p1', 'p2'])).toHaveLength(1);
  });

  it('adds 1=0 sentinel when restrictedIds is empty array', () => {
    expect(buildPersonsWhere(baseFilters, [])).toHaveLength(1);
  });

  it('does not add restriction when restrictedIds is undefined', () => {
    expect(buildPersonsWhere(baseFilters, undefined)).toHaveLength(0);
  });

  it('combines multiple filters', () => {
    expect(buildPersonsWhere({ ...baseFilters, sex: ['F'], bornFrom: 1900, citations: 'gte3' })).toHaveLength(3);
  });
});
