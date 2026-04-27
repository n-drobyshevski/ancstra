import { describe, it, expect } from 'vitest';
import { countActiveFilters } from '../../lib/persons/active-filter-count';
import type { PersonsFilters } from '../../lib/persons/search-params';

const baseFilters: PersonsFilters = {
  q: '', sex: [], living: [], validation: [],
  bornFrom: null, bornTo: null, diedFrom: null, diedTo: null,
  place: '', placeScope: 'birth', citations: 'any',
  hasProposals: false, complGte: null,
  sort: 'edited', dir: 'desc', page: 1, size: 20, hide: [],
};

describe('countActiveFilters', () => {
  it('returns 0 for default filters', () => {
    expect(countActiveFilters(baseFilters)).toBe(0);
  });

  it('counts q as 1 when non-empty', () => {
    expect(countActiveFilters({ ...baseFilters, q: 'smith' })).toBe(1);
  });

  it('counts sex array as 1 when any selected (not all 3)', () => {
    expect(countActiveFilters({ ...baseFilters, sex: ['M'] })).toBe(1);
    expect(countActiveFilters({ ...baseFilters, sex: ['M', 'F'] })).toBe(1);
    expect(countActiveFilters({ ...baseFilters, sex: ['M', 'F', 'U'] })).toBe(0);
  });

  it('counts born range as 1 when either bound set', () => {
    expect(countActiveFilters({ ...baseFilters, bornFrom: 1900 })).toBe(1);
    expect(countActiveFilters({ ...baseFilters, bornTo: 1950 })).toBe(1);
    expect(countActiveFilters({ ...baseFilters, bornFrom: 1900, bornTo: 1950 })).toBe(1);
  });

  it('counts citations as 1 when not "any"', () => {
    expect(countActiveFilters({ ...baseFilters, citations: 'gte1' })).toBe(1);
    expect(countActiveFilters({ ...baseFilters, citations: 'any' })).toBe(0);
  });

  it('counts hasProposals as 1 when true', () => {
    expect(countActiveFilters({ ...baseFilters, hasProposals: true })).toBe(1);
  });

  it('does NOT count sort/dir/page/size/hide as active filters', () => {
    expect(countActiveFilters({
      ...baseFilters, sort: 'name', dir: 'asc', page: 5, size: 50, hide: ['sex'],
    })).toBe(0);
  });

  it('sums multiple dimensions', () => {
    expect(countActiveFilters({
      ...baseFilters, q: 'smith', sex: ['F'], bornFrom: 1900, citations: 'gte3',
    })).toBe(4);
  });
});
