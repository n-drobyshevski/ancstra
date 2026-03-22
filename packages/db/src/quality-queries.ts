import type Database from 'better-sqlite3';

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
 * Uses raw SQL for complex multi-table aggregations.
 */
export function getQualitySummary(db: Database.Database): QualitySummary {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total_persons,
      SUM(CASE WHEN has_name = 1 THEN 1 ELSE 0 END) AS with_name,
      SUM(CASE WHEN has_birth = 1 THEN 1 ELSE 0 END) AS with_birth,
      SUM(CASE WHEN has_birth_place = 1 THEN 1 ELSE 0 END) AS with_birth_place,
      SUM(CASE WHEN has_death = 1 THEN 1 ELSE 0 END) AS with_death,
      SUM(non_living) AS non_living,
      SUM(CASE WHEN has_source = 1 THEN 1 ELSE 0 END) AS with_source
    FROM (
      SELECT
        p.id,
        CASE WHEN p.is_living = 0 THEN 1 ELSE 0 END AS non_living,
        CASE WHEN EXISTS (
          SELECT 1 FROM person_names pn
          WHERE pn.person_id = p.id
            AND pn.given_name IS NOT NULL AND pn.given_name != ''
            AND pn.surname IS NOT NULL AND pn.surname != ''
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
        ) THEN 1 ELSE 0 END AS has_source
      FROM persons p
      WHERE p.deleted_at IS NULL
    ) sub
  `).get() as {
    total_persons: number;
    with_name: number;
    with_birth: number;
    with_birth_place: number;
    with_death: number;
    non_living: number;
    with_source: number;
  };

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
 * Score = (hasName * 20) + (hasBirth * 25) + (hasBirthPlace * 20) + (hasDeath * 15) + (hasSource * 20)
 */
export function getPriorities(
  db: Database.Database,
  page = 1,
  pageSize = 20,
): {
  persons: PriorityPerson[];
  total: number;
  page: number;
  pageSize: number;
} {
  const offset = (page - 1) * pageSize;

  const countRow = db.prepare(`
    SELECT COUNT(*) AS cnt FROM persons WHERE deleted_at IS NULL
  `).get() as { cnt: number };
  const total = countRow.cnt;

  const rows = db.prepare(`
    SELECT
      p.id,
      COALESCE(pn.given_name, '') AS given_name,
      COALESCE(pn.surname, '') AS surname,
      (
        CASE WHEN pn.given_name IS NOT NULL AND pn.given_name != ''
              AND pn.surname IS NOT NULL AND pn.surname != ''
        THEN 20 ELSE 0 END
      ) + (
        CASE WHEN EXISTS (
          SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth'
        ) THEN 25 ELSE 0 END
      ) + (
        CASE WHEN EXISTS (
          SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth'
            AND e.place_text IS NOT NULL AND e.place_text != ''
        ) THEN 20 ELSE 0 END
      ) + (
        CASE WHEN EXISTS (
          SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'death'
        ) THEN 15 ELSE 0 END
      ) + (
        CASE WHEN EXISTS (
          SELECT 1 FROM source_citations sc WHERE sc.person_id = p.id
        ) THEN 20 ELSE 0 END
      ) AS score,
      CASE WHEN pn.given_name IS NULL OR pn.given_name = ''
                OR pn.surname IS NULL OR pn.surname = ''
      THEN 1 ELSE 0 END AS missing_name,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth'
      ) THEN 1 ELSE 0 END AS missing_birth,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth'
          AND e.place_text IS NOT NULL AND e.place_text != ''
      ) THEN 1 ELSE 0 END AS missing_birth_place,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'death'
      ) THEN 1 ELSE 0 END AS missing_death,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM source_citations sc WHERE sc.person_id = p.id
      ) THEN 1 ELSE 0 END AS missing_source
    FROM persons p
    LEFT JOIN person_names pn
      ON pn.person_id = p.id AND pn.is_primary = 1
    WHERE p.deleted_at IS NULL
    ORDER BY score ASC, p.id ASC
    LIMIT ? OFFSET ?
  `).all(pageSize, offset) as Array<{
    id: string;
    given_name: string;
    surname: string;
    score: number;
    missing_name: number;
    missing_birth: number;
    missing_birth_place: number;
    missing_death: number;
    missing_source: number;
  }>;

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
