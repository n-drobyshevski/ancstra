import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  COMPLETENESS_WEIGHTS,
  COMPLETENESS_LIVING_DENOMINATOR,
} from '@ancstra/shared';

// Bare SQL identifier: starts with a letter or underscore, then letters/digits/underscores.
// Conservative on purpose — refuse anything that could include quotes, spaces, or operators.
const SAFE_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeAlias(name: string, param: string): void {
  if (!SAFE_ALIAS.test(name)) {
    throw new Error(
      `unsafe ${param} alias "${name}". Must be a bare SQL identifier.`,
    );
  }
}

/**
 * Returns the SELECT body of the `person_flags` CTE used by all per-row
 * completeness queries. Caller wraps it: `WITH person_flags AS (${...body})`.
 *
 * Always uses LEFT JOIN to person_names — persons without a primary name row
 * appear with has_name = 0. Callers wanting to exclude such rows must do so
 * in their outer query.
 *
 * @param personAlias  Alias for the persons table within the CTE.
 * @throws if personAlias is not a bare SQL identifier.
 */
export function completenessFlagsCteBody(personAlias: string): SQL {
  assertSafeAlias(personAlias, 'personAlias');
  return sql.raw(`
    SELECT
      ${personAlias}.id,
      CASE WHEN pn.given_name IS NOT NULL AND pn.given_name <> '' AND pn.surname IS NOT NULL AND pn.surname <> '' THEN 1 ELSE 0 END AS has_name,
      CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = ${personAlias}.id AND e.event_type = 'birth') THEN 1 ELSE 0 END AS has_birth_event,
      CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = ${personAlias}.id AND e.event_type = 'birth' AND e.place_text IS NOT NULL AND e.place_text <> '') THEN 1 ELSE 0 END AS has_birth_place,
      CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.person_id = ${personAlias}.id AND e.event_type = 'death') THEN 1 ELSE 0 END AS has_death_event,
      CASE WHEN EXISTS (SELECT 1 FROM source_citations sc WHERE sc.person_id = ${personAlias}.id) THEN 1 ELSE 0 END AS has_source
    FROM persons ${personAlias}
    LEFT JOIN person_names pn ON pn.person_id = ${personAlias}.id AND pn.is_primary = 1
    WHERE ${personAlias}.deleted_at IS NULL
  `);
}

/**
 * Renders the per-row completeness score expression as a SQL fragment.
 *
 * For effective-living persons (`is_living = 1 AND has_death_event = 0`),
 * the score is renormalized: 4-dimension raw sum scaled to 0..100.
 * Otherwise it's the unmodified 5-dimension sum.
 *
 * Both branches return a 0..100 INTEGER, so callers can sort/filter on
 * the result without further normalization.
 *
 * Weights flow from COMPLETENESS_WEIGHTS in @ancstra/shared so SQL and TS
 * helper agree on every input.
 *
 * @param personAlias  SQL alias of the persons row (only `is_living` is read)
 * @param flagsAlias   SQL alias of the flags CTE (must expose has_name,
 *                     has_birth_event, has_birth_place, has_death_event,
 *                     has_source)
 * @throws Error if either alias is not a bare SQL identifier.
 */
export function completenessScoreExpr(
  personAlias: string,
  flagsAlias: string,
): SQL {
  assertSafeAlias(personAlias, 'personAlias');
  assertSafeAlias(flagsAlias, 'flagsAlias');
  const W = COMPLETENESS_WEIGHTS;
  const D = COMPLETENESS_LIVING_DENOMINATOR;
  return sql.raw(
    `CASE WHEN ${personAlias}.is_living = 1 AND ${flagsAlias}.has_death_event = 0
      THEN CAST(ROUND(
        (${flagsAlias}.has_name * ${W.name} + ${flagsAlias}.has_birth_event * ${W.birth}
         + ${flagsAlias}.has_birth_place * ${W.birthPlace} + ${flagsAlias}.has_source * ${W.source})
        * 100.0 / ${D}
      ) AS INTEGER)
      ELSE CAST(
        ${flagsAlias}.has_name * ${W.name} + ${flagsAlias}.has_birth_event * ${W.birth}
        + ${flagsAlias}.has_birth_place * ${W.birthPlace} + ${flagsAlias}.has_death_event * ${W.death}
        + ${flagsAlias}.has_source * ${W.source}
      AS INTEGER)
    END`,
  );
}
