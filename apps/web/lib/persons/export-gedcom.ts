import type { Database } from '@ancstra/db';
import { serializeToGedcom } from '@/lib/gedcom/serialize';
import type { PersonsFilters } from './search-params';
import { queryPersonsForGedcomExport } from './query-export';

/**
 * Export the filter-matching persons (with one hop of family neighbors) as a GEDCOM 5.5.1 string.
 * mode='shareable' redacts living persons.
 */
export async function exportPersonsToGedcom(
  db: Database,
  filters: PersonsFilters,
  excludeIds: readonly string[] = [],
  explicitIds?: readonly string[],
): Promise<string> {
  const data = await queryPersonsForGedcomExport(db, filters, excludeIds, explicitIds);
  return serializeToGedcom(data, 'shareable');
}
