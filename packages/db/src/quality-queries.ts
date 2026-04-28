import { sql } from 'drizzle-orm';
import type { FamilyDatabase } from './index';
import {
  completenessFlagsCteBody,
  completenessScoreExpr,
} from './completeness-sql';

export interface QualityMetric {
  label: string;
  value: number;
  total: number;
  count: number;
}

export interface QualitySummary {
  totalPersons: number;
  overallScore: number;
  metrics: QualityMetric[];
}

export interface PriorityPerson {
  id: string;
  givenName: string;
  surname: string;
  score: number;
  missingFields: string[];
}

/**
 * Get a summary of data quality metrics across all non-deleted persons.
 *
 * Single-pass aggregation: pre-aggregates per-person flags from person_names,
 * events, and source_citations in CTEs, then joins persons once. Replaces
 * the previous N correlated EXISTS subqueries (one scan vs ~5N seeks).
 */
export async function getQualitySummary(db: FamilyDatabase): Promise<QualitySummary> {
  const [row] = await db.all<{
    total_persons: number;
    with_name: number;
    with_birth: number;
    with_birth_place: number;
    with_death: number;
    non_living: number;
    with_source: number;
  }>(sql`
    WITH name_flags AS (
      SELECT
        person_id,
        MAX(CASE WHEN given_name IS NOT NULL AND given_name != ''
                  AND surname IS NOT NULL AND surname != ''
                THEN 1 ELSE 0 END) AS has_name
      FROM person_names
      GROUP BY person_id
    ),
    event_flags AS (
      SELECT
        person_id,
        MAX(CASE WHEN event_type = 'birth' THEN 1 ELSE 0 END) AS has_birth,
        MAX(CASE WHEN event_type = 'birth'
                  AND place_text IS NOT NULL AND place_text != ''
                THEN 1 ELSE 0 END) AS has_birth_place,
        MAX(CASE WHEN event_type = 'death' THEN 1 ELSE 0 END) AS has_death
      FROM events
      GROUP BY person_id
    ),
    source_flags AS (
      SELECT person_id, 1 AS has_source
      FROM source_citations
      WHERE person_id IS NOT NULL
      GROUP BY person_id
    )
    SELECT
      COUNT(*) AS total_persons,
      SUM(COALESCE(nf.has_name, 0)) AS with_name,
      SUM(COALESCE(ef.has_birth, 0)) AS with_birth,
      SUM(COALESCE(ef.has_birth_place, 0)) AS with_birth_place,
      SUM(COALESCE(ef.has_death, 0)) AS with_death,
      SUM(CASE WHEN p.is_living = 0 THEN 1 ELSE 0 END) AS non_living,
      SUM(COALESCE(sf.has_source, 0)) AS with_source
    FROM persons p
    LEFT JOIN name_flags nf ON nf.person_id = p.id
    LEFT JOIN event_flags ef ON ef.person_id = p.id
    LEFT JOIN source_flags sf ON sf.person_id = p.id
    WHERE p.deleted_at IS NULL
  `);

  const total = row.total_persons;
  if (total === 0) {
    return {
      totalPersons: 0,
      overallScore: 0,
      metrics: [],
    };
  }

  const withName = row.with_name ?? 0;
  const withBirth = row.with_birth ?? 0;
  const withBirthPlace = row.with_birth_place ?? 0;
  const withDeath = row.with_death ?? 0;
  const nonLiving = row.non_living ?? 0;
  const withSource = row.with_source ?? 0;

  const pctName = Math.round((withName / total) * 100);
  const pctBirth = Math.round((withBirth / total) * 100);
  const pctBirthPlace = Math.round((withBirthPlace / total) * 100);
  // Death percentage is relative to non-living persons only
  const pctDeath = nonLiving > 0 ? Math.round((withDeath / nonLiving) * 100) : 100;
  const pctSource = Math.round((withSource / total) * 100);

  const metrics: QualityMetric[] = [
    { label: 'Has Name', value: pctName, total, count: withName },
    { label: 'Has Birth Date', value: pctBirth, total, count: withBirth },
    { label: 'Has Birth Place', value: pctBirthPlace, total, count: withBirthPlace },
    { label: 'Has Death Date', value: pctDeath, total: nonLiving, count: withDeath },
    { label: 'Has Source', value: pctSource, total, count: withSource },
  ];

  const overallScore = Math.round(
    metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
  );

  return {
    totalPersons: total,
    overallScore,
    metrics,
  };
}

/**
 * Get persons sorted by lowest completeness score first (research priorities).
 * Score uses the shared completenessScoreExpr fragment (living-aware renormalization).
 */
export async function getPriorities(
  db: FamilyDatabase,
  page = 1,
  pageSize = 20,
): Promise<{
  persons: PriorityPerson[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const offset = (page - 1) * pageSize;

  const [countRow] = await db.all<{ cnt: number }>(sql`
    SELECT COUNT(*) AS cnt FROM persons WHERE deleted_at IS NULL
  `);
  const total = countRow.cnt;

  const rows = await db.all<{
    id: string;
    given_name: string;
    surname: string;
    score: number;
    missing_name: number;
    missing_birth: number;
    missing_birth_place: number;
    missing_death: number;
    missing_source: number;
  }>(sql`
    WITH person_flags AS (${completenessFlagsCteBody('p')})
    SELECT
      p.id,
      COALESCE(pn.given_name, '') AS given_name,
      COALESCE(pn.surname, '') AS surname,
      ${completenessScoreExpr('p', 'pf')} AS score,
      CASE WHEN pf.has_name = 0 THEN 1 ELSE 0 END AS missing_name,
      CASE WHEN pf.has_birth_event = 0 THEN 1 ELSE 0 END AS missing_birth,
      CASE WHEN pf.has_birth_place = 0 THEN 1 ELSE 0 END AS missing_birth_place,
      CASE WHEN pf.has_death_event = 0 AND p.is_living = 0 THEN 1 ELSE 0 END AS missing_death,
      CASE WHEN pf.has_source = 0 THEN 1 ELSE 0 END AS missing_source
    FROM persons p
    LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    INNER JOIN person_flags pf ON pf.id = p.id
    WHERE p.deleted_at IS NULL
    ORDER BY score ASC, p.id ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const persons: PriorityPerson[] = rows.map((r) => {
    const missingFields: string[] = [];
    if (r.missing_name) missingFields.push('name');
    if (r.missing_birth) missingFields.push('birthDate');
    if (r.missing_birth_place) missingFields.push('birthPlace');
    if (r.missing_death) missingFields.push('deathDate');
    if (r.missing_source) missingFields.push('source');
    return {
      id: r.id,
      givenName: r.given_name,
      surname: r.surname,
      score: r.score,
      missingFields,
    };
  });

  return { persons, total, page, pageSize };
}
