import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// Bare SQL identifier: starts with a letter or underscore, then letters/digits/underscores.
// Conservative on purpose — refuse anything that could include quotes, spaces, or operators.
const SAFE_ALIAS = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertSafeAlias(name: string, param: string): void {
  if (!SAFE_ALIAS.test(name)) {
    throw new Error(
      `completenessScoreExpr: unsafe ${param} alias "${name}". Must be a bare SQL identifier.`,
    );
  }
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
 * Weights must stay in sync with COMPLETENESS_WEIGHTS in
 * `apps/web/lib/persons/completeness.ts`:
 *   name:20  birth:25  birthPlace:20  death:15  source:20  → total 100
 * Living denominator (death excluded): 20 + 25 + 20 + 20 = 85.
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
  return sql.raw(
    `CASE WHEN ${personAlias}.is_living = 1 AND ${flagsAlias}.has_death_event = 0
      THEN CAST(ROUND(
        (${flagsAlias}.has_name * 20 + ${flagsAlias}.has_birth_event * 25
         + ${flagsAlias}.has_birth_place * 20 + ${flagsAlias}.has_source * 20)
        * 100.0 / 85
      ) AS INTEGER)
      ELSE CAST(
        ${flagsAlias}.has_name * 20 + ${flagsAlias}.has_birth_event * 25
        + ${flagsAlias}.has_birth_place * 20 + ${flagsAlias}.has_death_event * 15
        + ${flagsAlias}.has_source * 20
      AS INTEGER)
    END`,
  );
}
