import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import type { PersonListItem } from '@ancstra/shared';
import type { PersonsFilters } from './search-params';
import { buildPersonsWhere } from './filters-to-where';
import { searchPersonsFts } from '../queries';

export interface PersonsListResult {
  items: PersonListItem[];
  total: number;
}

const SORT_COLUMN: Record<PersonsFilters['sort'], string> = {
  name: 'ps.surname',
  born: 'ps.birth_date_sort',
  died: 'ps.death_date_sort',
  compl: 'ps.completeness',
  edited: 'ps.updated_at_sort',
  sources: 'ps.sources_count',
};

// Reads directly from the denormalized person_summary table — facets are
// populated at write time by refreshSummary/rebuildAllSummaries, so this is
// a single indexed scan instead of the prior multi-CTE per-row recomputation.
export async function queryPersonsList(
  db: Database,
  filters: PersonsFilters,
): Promise<PersonsListResult> {
  let restrictedIds: readonly string[] | undefined;
  if (filters.q.trim() !== '') {
    const ftsResults = await searchPersonsFts(db, filters.q.trim(), 1000);
    restrictedIds = ftsResults.map((r) => r.id);
  }

  const whereConds = buildPersonsWhere(filters, restrictedIds);
  const whereSql =
    whereConds.length > 0
      ? sql.join([sql`WHERE `, sql.join(whereConds, sql` AND `)], sql``)
      : sql``;

  const sortCol = SORT_COLUMN[filters.sort];
  const dir = filters.dir === 'desc' ? sql.raw('DESC') : sql.raw('ASC');
  const sortClause =
    filters.sort === 'born' || filters.sort === 'died'
      ? sql`ORDER BY ${sql.raw(sortCol)} ${dir} NULLS LAST, ps.person_id ASC`
      : sql`ORDER BY ${sql.raw(sortCol)} ${dir}, ps.person_id ASC`;

  const offset = (filters.page - 1) * filters.size;

  const rows = await db.all<{
    id: string; sex: 'M' | 'F' | 'U'; is_living: number;
    given_name: string; surname: string;
    birth_date: string | null; death_date: string | null; birth_place: string | null;
    completeness: number; sources_count: number;
    has_name: number; has_birth_event: number; has_birth_place: number;
    has_death_event: number; has_source: number;
    validation: 'confirmed' | 'proposed'; updated_at: string;
    total: number;
  }>(sql`
    SELECT
      ps.person_id AS id, ps.sex, ps.is_living,
      ps.given_name, ps.surname,
      ps.birth_date, ps.death_date, ps.birth_place,
      ps.completeness, ps.sources_count,
      ps.has_name, ps.has_birth_event, ps.has_birth_place,
      ps.has_death_event, ps.has_source,
      ps.validation,
      ps.updated_at_sort AS updated_at,
      count(*) OVER () AS total
    FROM person_summary ps
    ${whereSql}
    ${sortClause}
    LIMIT ${filters.size} OFFSET ${offset}
  `);

  const items: PersonListItem[] = rows.map((r) => ({
    id: r.id, sex: r.sex, isLiving: Boolean(r.is_living),
    givenName: r.given_name, surname: r.surname,
    birthDate: r.birth_date, deathDate: r.death_date, birthPlace: r.birth_place,
    completeness: r.completeness, sourcesCount: r.sources_count,
    hasName: Boolean(r.has_name),
    hasBirthEvent: Boolean(r.has_birth_event),
    hasBirthPlace: Boolean(r.has_birth_place),
    hasDeathEvent: Boolean(r.has_death_event),
    hasSource: Boolean(r.has_source),
    validation: r.validation, updatedAt: r.updated_at ?? '',
  }));

  const total = rows.length > 0 ? rows[0].total : 0;
  return { items, total };
}
