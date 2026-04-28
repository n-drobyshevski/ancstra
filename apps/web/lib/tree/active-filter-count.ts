import type { TreeTableFilters } from './search-params';

/**
 * Count active filter dimensions on the tree-table view (facets at non-default
 * values). Excluded: sort, dir, page, size, hide — display preferences, not
 * filters. topologyMode is included because it materially restricts the result.
 */
export function countActiveTreeFilters(filters: TreeTableFilters): number {
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
  if (filters.topologyMode !== 'all' && filters.topologyAnchor) n++;
  return n;
}
