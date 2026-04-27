import type { PersonsFilters } from './search-params';

/**
 * Count the number of active filter dimensions (facets that aren't at default).
 * Excluded: sort, dir, page, size, hide — these are display preferences, not filters.
 */
export function countActiveFilters(filters: PersonsFilters): number {
  let n = 0;
  if (filters.q.trim() !== '') n++;
  if (filters.sex.length > 0 && filters.sex.length < 3) n++;
  if (filters.living.length === 1) n++;
  if (filters.validation.length === 1) n++;
  if (filters.bornFrom !== null || filters.bornTo !== null) n++;
  if (filters.diedFrom !== null || filters.diedTo !== null) n++;
  if (filters.place.trim() !== '') n++;
  if (filters.citations !== 'any') n++;
  if (filters.hasProposals) n++;
  if (filters.complGte !== null) n++;
  return n;
}
