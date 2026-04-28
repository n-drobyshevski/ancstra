/**
 * Per-row completeness score weights. Each dimension contributes its weight
 * when present; the sum of all five is 100.
 *
 * Single source of truth — read by:
 * - SQL fragment in @ancstra/db/completeness-sql.ts (consumed by query-persons-list.ts,
 *   queries.ts, and quality-queries.ts)
 * - TS helper in apps/web/lib/persons/completeness.ts (consumed by CompletenessCell)
 *
 * Both consumers MUST read from this constant — never inline literals.
 */
export const COMPLETENESS_WEIGHTS = {
  name: 20,
  birth: 25,
  birthPlace: 20,
  death: 15,
  source: 20,
} as const;

export type CompletenessKey = keyof typeof COMPLETENESS_WEIGHTS;

/**
 * Sum of weights applicable to effective-living persons (death excluded).
 * Used as the renormalization denominator. Exported as a constant so SQL and
 * TS use the same value rather than independently summing.
 *
 * For current weights this evaluates to 85 (20 + 25 + 20 + 20).
 */
export const COMPLETENESS_LIVING_DENOMINATOR =
  COMPLETENESS_WEIGHTS.name +
  COMPLETENESS_WEIGHTS.birth +
  COMPLETENESS_WEIGHTS.birthPlace +
  COMPLETENESS_WEIGHTS.source;
