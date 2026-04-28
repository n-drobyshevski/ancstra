import { sql } from 'drizzle-orm';
import type { FamilyDatabase } from './index';
import { completenessScoreExpr } from './completeness-sql';

// Reused once at module load — both materializer fns use the same CTE alias 'src'.
const COMPLETENESS = completenessScoreExpr('src', 'src');

/**
 * Refresh the person_summary row for a single person.
 * Computes all denormalized columns (display fields + facets + counts) in one
 * INSERT...SELECT. If the person doesn't exist or is deleted, the row is removed.
 */
export async function refreshSummary(db: FamilyDatabase, personId: string): Promise<void> {
  // Remove existing row first (handles deleted/nonexistent persons cleanly)
  await db.run(sql`DELETE FROM person_summary WHERE person_id = ${personId}`);

  const now = new Date().toISOString();

  await db.run(sql`
    INSERT INTO person_summary (
      person_id, given_name, surname, sex, is_living,
      birth_date, death_date, birth_date_sort, death_date_sort,
      birth_place, death_place, spouse_count, child_count, parent_count,
      has_name, has_birth_event, has_birth_place, has_death_event,
      has_source, sources_count, completeness, validation,
      updated_at_sort, updated_at
    )
    WITH src AS (
      SELECT
        p.id,
        p.sex,
        p.is_living,
        p.updated_at AS person_updated_at,
        COALESCE(pn.given_name, '') AS given_name,
        COALESCE(pn.surname, '')   AS surname,
        b.date_original AS birth_date,
        b.date_sort     AS birth_date_sort,
        b.place_text    AS birth_place,
        d.date_original AS death_date,
        d.date_sort     AS death_date_sort,
        d.place_text    AS death_place,
        CASE WHEN pn.given_name IS NOT NULL AND pn.given_name <> ''
              AND pn.surname    IS NOT NULL AND pn.surname    <> ''
             THEN 1 ELSE 0 END AS has_name,
        CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS has_birth_event,
        CASE WHEN b.place_text IS NOT NULL AND b.place_text <> ''
             THEN 1 ELSE 0 END AS has_birth_place,
        CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END AS has_death_event,
        (SELECT COUNT(*) FROM source_citations sc WHERE sc.person_id = p.id) AS sources_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM source_citations sc2 WHERE sc2.person_id = p.id
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
        (SELECT COUNT(*) FROM families f2
         WHERE f2.deleted_at IS NULL
           AND f2.partner1_id IS NOT NULL AND f2.partner2_id IS NOT NULL
           AND (f2.partner1_id = p.id OR f2.partner2_id = p.id)) AS spouse_count,
        (SELECT COUNT(DISTINCT c2.person_id) FROM children c2
         JOIN families f3 ON f3.id = c2.family_id AND f3.deleted_at IS NULL
         WHERE f3.partner1_id = p.id OR f3.partner2_id = p.id) AS child_count,
        (SELECT COUNT(DISTINCT CASE WHEN f4.partner1_id IS NOT NULL AND f4.partner1_id != p.id THEN f4.partner1_id END)
              + COUNT(DISTINCT CASE WHEN f4.partner2_id IS NOT NULL AND f4.partner2_id != p.id THEN f4.partner2_id END)
         FROM children c3
         JOIN families f4 ON f4.id = c3.family_id AND f4.deleted_at IS NULL
         WHERE c3.person_id = p.id) AS parent_count
      FROM persons p
      LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
      LEFT JOIN events b ON b.person_id = p.id AND b.event_type = 'birth'
      LEFT JOIN events d ON d.person_id = p.id AND d.event_type = 'death'
      WHERE p.id = ${personId} AND p.deleted_at IS NULL
      LIMIT 1
    )
    SELECT
      src.id, src.given_name, src.surname, src.sex, src.is_living,
      src.birth_date, src.death_date, src.birth_date_sort, src.death_date_sort,
      src.birth_place, src.death_place,
      src.spouse_count, src.child_count, src.parent_count,
      src.has_name, src.has_birth_event, src.has_birth_place, src.has_death_event,
      src.has_source,
      src.sources_count,
      ${COMPLETENESS} AS completeness,
      src.validation,
      src.person_updated_at AS updated_at_sort,
      ${now}
    FROM src
  `);
}

/**
 * Full rebuild: delete all person_summary rows, then re-populate from
 * persons + names + events in a single INSERT...SELECT.
 */
export async function rebuildAllSummaries(db: FamilyDatabase): Promise<void> {
  const now = new Date().toISOString();

  await db.run(sql`DELETE FROM person_summary`);

  await db.run(sql`
    INSERT INTO person_summary (
      person_id, given_name, surname, sex, is_living,
      birth_date, death_date, birth_date_sort, death_date_sort,
      birth_place, death_place, spouse_count, child_count, parent_count,
      has_name, has_birth_event, has_birth_place, has_death_event,
      has_source, sources_count, completeness, validation,
      updated_at_sort, updated_at
    )
    WITH src AS (
      SELECT
        p.id,
        p.sex,
        p.is_living,
        p.updated_at AS person_updated_at,
        COALESCE(pn.given_name, '') AS given_name,
        COALESCE(pn.surname, '')   AS surname,
        b.date_original AS birth_date,
        b.date_sort     AS birth_date_sort,
        b.place_text    AS birth_place,
        d.date_original AS death_date,
        d.date_sort     AS death_date_sort,
        d.place_text    AS death_place,
        CASE WHEN pn.given_name IS NOT NULL AND pn.given_name <> ''
              AND pn.surname    IS NOT NULL AND pn.surname    <> ''
             THEN 1 ELSE 0 END AS has_name,
        CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS has_birth_event,
        CASE WHEN b.place_text IS NOT NULL AND b.place_text <> ''
             THEN 1 ELSE 0 END AS has_birth_place,
        CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END AS has_death_event,
        (SELECT COUNT(*) FROM source_citations sc WHERE sc.person_id = p.id) AS sources_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM source_citations sc2 WHERE sc2.person_id = p.id
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
        (SELECT COUNT(*) FROM families f2
         WHERE f2.deleted_at IS NULL
           AND f2.partner1_id IS NOT NULL AND f2.partner2_id IS NOT NULL
           AND (f2.partner1_id = p.id OR f2.partner2_id = p.id)) AS spouse_count,
        (SELECT COUNT(DISTINCT c2.person_id) FROM children c2
         JOIN families f3 ON f3.id = c2.family_id AND f3.deleted_at IS NULL
         WHERE f3.partner1_id = p.id OR f3.partner2_id = p.id) AS child_count,
        (SELECT COUNT(DISTINCT CASE WHEN f4.partner1_id IS NOT NULL AND f4.partner1_id != p.id THEN f4.partner1_id END)
              + COUNT(DISTINCT CASE WHEN f4.partner2_id IS NOT NULL AND f4.partner2_id != p.id THEN f4.partner2_id END)
         FROM children c3
         JOIN families f4 ON f4.id = c3.family_id AND f4.deleted_at IS NULL
         WHERE c3.person_id = p.id) AS parent_count
      FROM persons p
      LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
      LEFT JOIN events b ON b.person_id = p.id AND b.event_type = 'birth'
      LEFT JOIN events d ON d.person_id = p.id AND d.event_type = 'death'
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
    )
    SELECT
      src.id, src.given_name, src.surname, src.sex, src.is_living,
      src.birth_date, src.death_date, src.birth_date_sort, src.death_date_sort,
      src.birth_place, src.death_place,
      src.spouse_count, src.child_count, src.parent_count,
      src.has_name, src.has_birth_event, src.has_birth_place, src.has_death_event,
      src.has_source,
      src.sources_count,
      ${COMPLETENESS} AS completeness,
      src.validation,
      src.person_updated_at AS updated_at_sort,
      ${now}
    FROM src
  `);
}

/**
 * Refresh summaries for a person and all their immediate family members
 * (spouses, parents, children). Collects all related IDs in 3 queries,
 * then refreshes each.
 */
export async function refreshRelatedSummaries(db: FamilyDatabase, personId: string): Promise<void> {
  // Single query to collect all related person IDs
  const relatedRows = await db.all<{ person_id: string }>(sql`
    SELECT DISTINCT person_id FROM (
      -- Self
      SELECT ${personId} AS person_id
      -- Spouses (other partner in families where this person is a partner)
      UNION SELECT CASE WHEN f.partner1_id = ${personId} THEN f.partner2_id ELSE f.partner1_id END
        FROM families f
        WHERE f.deleted_at IS NULL
          AND (f.partner1_id = ${personId} OR f.partner2_id = ${personId})
          AND f.partner1_id IS NOT NULL AND f.partner2_id IS NOT NULL
      -- Parents (partners of families where this person is a child)
      UNION SELECT f2.partner1_id FROM children c
        JOIN families f2 ON f2.id = c.family_id AND f2.deleted_at IS NULL
        WHERE c.person_id = ${personId} AND f2.partner1_id IS NOT NULL
      UNION SELECT f3.partner2_id FROM children c2
        JOIN families f3 ON f3.id = c2.family_id AND f3.deleted_at IS NULL
        WHERE c2.person_id = ${personId} AND f3.partner2_id IS NOT NULL
      -- Children (children of families where this person is a partner)
      UNION SELECT c3.person_id FROM children c3
        JOIN families f4 ON f4.id = c3.family_id AND f4.deleted_at IS NULL
        WHERE f4.partner1_id = ${personId} OR f4.partner2_id = ${personId}
    ) WHERE person_id IS NOT NULL
  `);

  for (const row of relatedRows) {
    await refreshSummary(db, row.person_id);
  }
}
