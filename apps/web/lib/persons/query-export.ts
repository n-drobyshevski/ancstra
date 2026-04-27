import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import type { PersonsFilters } from './search-params';
import { buildPersonsWhere } from './filters-to-where';
import { searchPersonsFts } from '../queries';
import type { CsvExportRow } from './export-csv';

const HARD_CAP = 50_000;

/**
 * Query the export rows for CSV. Mirrors queryPersonsList's CTE but adds
 * deathPlace (which list views don't need) and ignores pagination — caps at HARD_CAP.
 */
export async function queryPersonsForCsvExport(
  db: Database,
  filters: PersonsFilters,
  excludeIds: readonly string[] = [],
  explicitIds?: readonly string[],
): Promise<CsvExportRow[]> {
  let restrictedIds: readonly string[] | undefined = explicitIds;
  if (!explicitIds && filters.q.trim() !== '') {
    const ftsResults = await searchPersonsFts(db, filters.q.trim(), HARD_CAP);
    restrictedIds = ftsResults.map((r) => r.id);
  }

  const whereConds = buildPersonsWhere(filters, restrictedIds);
  const whereSql =
    whereConds.length > 0
      ? sql.join([sql`WHERE `, sql.join(whereConds, sql` AND `)], sql``)
      : sql``;

  const rows = await db.all<{
    id: string; sex: 'M' | 'F' | 'U'; is_living: number;
    given_name: string; surname: string;
    birth_date: string | null; birth_place: string | null;
    death_date: string | null; death_place: string | null;
    completeness: number; sources_count: number;
    validation: 'confirmed' | 'proposed'; updated_at: string;
  }>(sql`
    WITH person_facets AS (
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
        (
          CASE WHEN pn.given_name <> '' AND pn.surname <> '' THEN 20 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth') THEN 25 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' AND e.place_text IS NOT NULL AND e.place_text <> '') THEN 20 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'death') THEN 15 ELSE 0 END
          + CASE WHEN EXISTS (SELECT 1 FROM source_citations sc WHERE sc.person_id = p.id) THEN 20 ELSE 0 END
        ) AS completeness,
        (SELECT date_sort     FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS born_sort,
        (SELECT date_original FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS birth_date,
        (SELECT place_text    FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS birth_place,
        (SELECT date_sort     FROM events e WHERE e.person_id = p.id AND e.event_type = 'death' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS died_sort,
        (SELECT date_original FROM events e WHERE e.person_id = p.id AND e.event_type = 'death' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS death_date,
        (SELECT place_text    FROM events e WHERE e.person_id = p.id AND e.event_type = 'death' ORDER BY e.date_sort NULLS LAST LIMIT 1) AS death_place,
        (SELECT COUNT(*)      FROM source_citations sc WHERE sc.person_id = p.id) AS sources_count
      FROM persons p
      INNER JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
      WHERE p.deleted_at IS NULL
    )
    SELECT
      pf.id, pf.sex, pf.is_living,
      pf.given_name, pf.surname,
      pf.birth_date, pf.birth_place,
      pf.death_date, pf.death_place,
      pf.completeness, pf.sources_count,
      pf.validation, pf.updated_at
    FROM person_facets pf
    ${whereSql}
    ORDER BY pf.surname, pf.given_name, pf.id
    LIMIT ${HARD_CAP + 1}
  `);

  const exclude = new Set(excludeIds);
  const filtered = rows.filter((r) => !exclude.has(r.id));

  return filtered.map((r): CsvExportRow => ({
    id: r.id,
    givenName: r.given_name,
    surname: r.surname,
    sex: r.sex,
    isLiving: Boolean(r.is_living),
    birthDate: r.birth_date,
    birthPlace: r.birth_place,
    deathDate: r.death_date,
    deathPlace: r.death_place,
    completeness: r.completeness,
    sourcesCount: r.sources_count,
    validation: r.validation,
    updatedAt: r.updated_at,
  }));
}

export const EXPORT_HARD_CAP = HARD_CAP;
