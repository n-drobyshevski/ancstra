import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

export interface PersonExtras {
  sourcesCount: number;
  completeness: number;
  validation: 'confirmed' | 'proposed';
  birthPlace: string | null;
  updatedAt: string;
}

export async function queryPersonExtras(
  db: Database,
  personIds: readonly string[],
): Promise<Map<string, PersonExtras>> {
  const result = new Map<string, PersonExtras>();
  if (personIds.length === 0) return result;

  const idList = sql.join(
    personIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const baseRows = await db.all<{
    id: string;
    has_name: number;
    has_birth: number;
    has_birth_place: number;
    has_death: number;
    has_source: number;
    validation: 'confirmed' | 'proposed';
    birth_place: string | null;
    updated_at: string;
  }>(sql`
    SELECT
      p.id,
      CASE WHEN EXISTS (
        SELECT 1 FROM person_names pn
        WHERE pn.person_id = p.id
          AND pn.given_name IS NOT NULL AND pn.given_name != ''
          AND pn.surname   IS NOT NULL AND pn.surname   != ''
      ) THEN 1 ELSE 0 END AS has_name,
      CASE WHEN EXISTS (
        SELECT 1 FROM events e
        WHERE e.person_id = p.id AND e.event_type = 'birth'
      ) THEN 1 ELSE 0 END AS has_birth,
      CASE WHEN EXISTS (
        SELECT 1 FROM events e
        WHERE e.person_id = p.id AND e.event_type = 'birth'
          AND e.place_text IS NOT NULL AND e.place_text != ''
      ) THEN 1 ELSE 0 END AS has_birth_place,
      CASE WHEN EXISTS (
        SELECT 1 FROM events e
        WHERE e.person_id = p.id AND e.event_type = 'death'
      ) THEN 1 ELSE 0 END AS has_death,
      CASE WHEN EXISTS (
        SELECT 1 FROM source_citations sc
        WHERE sc.person_id = p.id
      ) THEN 1 ELSE 0 END AS has_source,
      CASE WHEN EXISTS (
        SELECT 1 FROM families f
        WHERE f.deleted_at IS NULL
          AND (f.partner1_id = p.id OR f.partner2_id = p.id)
          AND f.validation_status IN ('proposed', 'disputed')
      ) OR EXISTS (
        SELECT 1 FROM children c
        WHERE c.person_id = p.id
          AND c.validation_status IN ('proposed', 'disputed')
      ) THEN 'proposed' ELSE 'confirmed' END AS validation,
      (
        SELECT e.place_text FROM events e
        WHERE e.person_id = p.id AND e.event_type = 'birth'
        ORDER BY e.date_sort
        LIMIT 1
      ) AS birth_place,
      p.updated_at AS updated_at
    FROM persons p
    WHERE p.id IN (${idList})
  `);

  const sourceRows = await db.all<{ person_id: string; n: number }>(sql`
    SELECT person_id, COUNT(*) AS n
    FROM source_citations
    WHERE person_id IN (${idList})
    GROUP BY person_id
  `);

  const sourceCounts = new Map<string, number>();
  for (const row of sourceRows) sourceCounts.set(row.person_id, row.n);

  for (const row of baseRows) {
    const completeness =
      row.has_name * 20 +
      row.has_birth * 25 +
      row.has_birth_place * 20 +
      row.has_death * 15 +
      row.has_source * 20;

    result.set(row.id, {
      sourcesCount: sourceCounts.get(row.id) ?? 0,
      completeness,
      validation: row.validation,
      birthPlace: row.birth_place,
      updatedAt: row.updated_at,
    });
  }

  return result;
}
