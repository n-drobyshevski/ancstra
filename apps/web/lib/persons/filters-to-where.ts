import { sql, type SQL } from 'drizzle-orm';
import type { PersonsFilters } from './search-params';

// All filter predicates run against `person_summary ps` (denormalized table
// with facet columns populated by refreshSummary/rebuildAllSummaries). This
// replaces the older `pf` CTE alias that re-derived the same data per query.
export function buildPersonsWhere(
  filters: PersonsFilters,
  restrictedIds?: readonly string[],
): SQL[] {
  const conditions: SQL[] = [];

  if (restrictedIds !== undefined) {
    if (restrictedIds.length === 0) {
      conditions.push(sql`1 = 0`);
      return conditions;
    }
    const idList = sql.join(restrictedIds.map((id) => sql`${id}`), sql`, `);
    conditions.push(sql`ps.person_id IN (${idList})`);
  }

  if (filters.sex.length > 0 && filters.sex.length < 3) {
    const list = sql.join(filters.sex.map((s) => sql`${s}`), sql`, `);
    conditions.push(sql`ps.sex IN (${list})`);
  }

  if (filters.living.length === 1) {
    if (filters.living[0] === 'alive') {
      conditions.push(sql`ps.is_living = 1`);
    } else {
      conditions.push(sql`ps.is_living = 0`);
    }
  }

  if (filters.validation.length === 1) {
    conditions.push(sql`ps.validation = ${filters.validation[0]}`);
  }

  if (filters.bornFrom !== null) {
    conditions.push(sql`ps.birth_date_sort >= ${filters.bornFrom * 10000}`);
  }
  if (filters.bornTo !== null) {
    conditions.push(sql`ps.birth_date_sort <= ${filters.bornTo * 10000 + 9999}`);
  }
  if (filters.diedFrom !== null) {
    conditions.push(sql`ps.death_date_sort >= ${filters.diedFrom * 10000}`);
  }
  if (filters.diedTo !== null) {
    conditions.push(sql`ps.death_date_sort <= ${filters.diedTo * 10000 + 9999}`);
  }

  if (filters.place.trim() !== '') {
    const pattern = `%${filters.place.trim()}%`;
    if (filters.placeScope === 'birth') {
      conditions.push(sql`EXISTS (SELECT 1 FROM events e WHERE e.person_id = ps.person_id AND e.event_type = 'birth' AND e.place_text LIKE ${pattern} COLLATE NOCASE)`);
    } else {
      conditions.push(sql`EXISTS (SELECT 1 FROM events e WHERE e.person_id = ps.person_id AND e.place_text LIKE ${pattern} COLLATE NOCASE)`);
    }
  }

  switch (filters.citations) {
    case 'none':
      conditions.push(sql`ps.sources_count = 0`);
      break;
    case 'gte1':
      conditions.push(sql`ps.sources_count >= 1`);
      break;
    case 'gte3':
      conditions.push(sql`ps.sources_count >= 3`);
      break;
    case 'any':
    default:
      break;
  }

  if (filters.complGte !== null) {
    conditions.push(sql`ps.completeness >= ${filters.complGte}`);
  }

  if (filters.hasProposals) {
    conditions.push(sql`EXISTS (SELECT 1 FROM proposed_relationships pr WHERE (pr.person1_id = ps.person_id OR pr.person2_id = ps.person_id) AND pr.status = 'pending')`);
  }

  return conditions;
}
