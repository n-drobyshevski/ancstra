import type { Database } from '@ancstra/db';
import { queryPersonsList } from './query-persons-list';
import type { PersonsFilters } from './search-params';

export type BulkScope =
  | { kind: 'ids'; ids: string[] }
  | { kind: 'matching'; filters: PersonsFilters; exclude: string[] };

const HARD_CAP = 50_000;

/**
 * Resolve a BulkScope to a concrete list of person IDs.
 *
 * - kind: 'ids' → returns the array verbatim
 * - kind: 'matching' → re-runs queryPersonsList with size=HARD_CAP, page=1, then removes excluded ids
 *
 * The HARD_CAP is enforced here so server-side endpoints can rely on the result being bounded.
 */
export async function resolveScope(db: Database, scope: BulkScope): Promise<string[]> {
  if (scope.kind === 'ids') {
    return [...scope.ids];
  }

  const result = await queryPersonsList(db, {
    ...scope.filters,
    page: 1,
    size: HARD_CAP as PersonsFilters['size'],
  });

  const exclude = new Set(scope.exclude);
  const ids = result.items.map((it) => it.id).filter((id) => !exclude.has(id));
  return ids;
}

export const RESOLVE_SCOPE_HARD_CAP = HARD_CAP;
