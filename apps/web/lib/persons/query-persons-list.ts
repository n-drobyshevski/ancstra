import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import type { PersonListItem } from '@ancstra/shared';
import { completenessScoreExpr } from '@ancstra/db/completeness-sql';
import type { PersonsFilters } from './search-params';
import { buildPersonsWhere } from './filters-to-where';
import { searchPersonsFts } from '../queries';

export interface PersonsListResult {
  items: PersonListItem[];
  total: number;
}

const SORT_COLUMN: Record<PersonsFilters['sort'], string> = {
  name: 'pf.surname',
  born: 'pf.born_sort',
  died: 'pf.died_sort',
  compl: 'pf.completeness',
  edited: 'pf.updated_at',
  sources: 'pf.sources_count',
};

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
      ? sql`ORDER BY ${sql.raw(sortCol)} ${dir} NULLS LAST, pf.id ASC`
      : sql`ORDER BY ${sql.raw(sortCol)} ${dir}, pf.id ASC`;

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
    WITH person_flags AS (
      SELECT
        p.id,
        CASE WHEN pn.given_name IS NOT NULL AND pn.given_name <> '' AND pn.surname IS NOT NULL AND pn.surname <> '' THEN 1 ELSE 0 END AS has_name,
        CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth') THEN 1 ELSE 0 END AS has_birth_event,
        CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' AND e.place_text IS NOT NULL AND e.place_text <> '') THEN 1 ELSE 0 END AS has_birth_place,
        CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'death') THEN 1 ELSE 0 END AS has_death_event,
        CASE WHEN EXISTS (SELECT 1 FROM source_citations sc WHERE sc.person_id = p.id) THEN 1 ELSE 0 END AS has_source
      FROM persons p
      INNER JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
      WHERE p.deleted_at IS NULL
    ),
    person_facets AS (
      SELECT
        p.id, p.sex, p.is_living, p.updated_at,
        COALESCE(pn.given_name, '') AS given_name,
        COALESCE(pn.surname, '')   AS surname,
        CASE WHEN EXISTS (
          SELECT 1 FROM families f
          WHERE f.deleted_at IS NULL
            AND (f.partner1_id = p.id OR f.partner2_id = p.id)
            AND f.validation_status IN ('proposed', 'disputed')
        )
        OR EXISTS (
          SELECT 1 FROM children c
          WHERE c.person_id = p.id
            AND c.validation_status IN ('proposed', 'disputed')
        ) THEN 'proposed' ELSE 'confirmed' END AS validation,
        pflag.has_name, pflag.has_birth_event, pflag.has_birth_place,
        pflag.has_death_event, pflag.has_source,
        ${completenessScoreExpr('p', 'pflag')} AS completeness,
        (SELECT date_sort     FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS born_sort,
        (SELECT date_original FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS birth_date,
        (SELECT place_text    FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS birth_place,
        (SELECT date_sort     FROM events e WHERE e.person_id = p.id AND e.event_type = 'death' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS died_sort,
        (SELECT date_original FROM events e WHERE e.person_id = p.id AND e.event_type = 'death' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS death_date,
        (SELECT COUNT(*)      FROM source_citations sc WHERE sc.person_id = p.id) AS sources_count
      FROM persons p
      INNER JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
      INNER JOIN person_flags pflag ON pflag.id = p.id
      WHERE p.deleted_at IS NULL
    )
    SELECT
      pf.id, pf.sex, pf.is_living,
      pf.given_name, pf.surname,
      pf.birth_date, pf.death_date, pf.birth_place,
      pf.completeness, pf.sources_count,
      pf.has_name, pf.has_birth_event, pf.has_birth_place,
      pf.has_death_event, pf.has_source,
      pf.validation, pf.updated_at,
      count(*) OVER () AS total
    FROM person_facets pf
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
    validation: r.validation, updatedAt: r.updated_at,
  }));

  const total = rows.length > 0 ? rows[0].total : 0;
  return { items, total };
}
