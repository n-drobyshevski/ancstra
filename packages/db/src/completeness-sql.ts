import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

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
 * Weights match `apps/web/lib/persons/completeness.ts` COMPLETENESS_WEIGHTS:
 * name 20, birth 25, birthPlace 20, death 15, source 20.
 *
 * @param personAlias  SQL alias of the persons row (must expose `is_living`)
 * @param flagsAlias   SQL alias of the flags CTE (must expose has_name,
 *                     has_birth_event, has_birth_place, has_death_event,
 *                     has_source)
 */
export function completenessScoreExpr(
  personAlias: string,
  flagsAlias: string,
): SQL {
  return sql.raw(
    `CASE WHEN ${personAlias}.is_living = 1 AND ${flagsAlias}.has_death_event = 0
      THEN CAST(ROUND(
        (${flagsAlias}.has_name * 20 + ${flagsAlias}.has_birth_event * 25
         + ${flagsAlias}.has_birth_place * 20 + ${flagsAlias}.has_source * 20)
        * 100.0 / 85
      ) AS INTEGER)
      ELSE ${flagsAlias}.has_name * 20 + ${flagsAlias}.has_birth_event * 25
           + ${flagsAlias}.has_birth_place * 20 + ${flagsAlias}.has_death_event * 15
           + ${flagsAlias}.has_source * 20
    END`,
  );
}
