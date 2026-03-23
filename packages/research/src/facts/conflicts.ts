import { sql, eq } from 'drizzle-orm';
import { researchFacts } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface ConflictPair {
  factType: string;
  valueA: string;
  valueB: string;
  confidenceA: string;
  confidenceB: string;
  factAId: string;
  factBId: string;
}

/** Fact types that naturally have multiple values and should not trigger conflicts. */
export const MULTI_VALUED_TYPES = ['residence', 'occupation', 'child_name', 'other'] as const;

/**
 * Detect conflicting facts for a person.
 * Finds pairs of facts with the same fact_type but different values,
 * excluding multi-valued types where multiple values are expected.
 */
export async function detectConflicts(db: Database, personId: string): Promise<ConflictPair[]> {
  const rows = await db.all<ConflictPair>(sql`
    SELECT f1.fact_type AS factType,
           f1.fact_value AS valueA,
           f2.fact_value AS valueB,
           f1.confidence AS confidenceA,
           f2.confidence AS confidenceB,
           f1.id AS factAId,
           f2.id AS factBId
    FROM research_facts f1
    JOIN research_facts f2
      ON f1.person_id = f2.person_id
     AND f1.fact_type = f2.fact_type
     AND f1.id < f2.id
     AND f1.fact_value != f2.fact_value
    WHERE f1.person_id = ${personId}
      AND f1.fact_type NOT IN ('residence', 'occupation', 'child_name', 'other')
  `);

  return rows;
}

/**
 * Resolve a conflict by setting the winner's confidence to 'high'
 * and the loser's confidence to 'disputed'.
 */
export async function resolveConflict(db: Database, winnerFactId: string, loserFactId: string): Promise<void> {
  await db.update(researchFacts)
    .set({ confidence: 'high', updatedAt: new Date().toISOString() })
    .where(eq(researchFacts.id, winnerFactId))
    .run();

  await db.update(researchFacts)
    .set({ confidence: 'disputed', updatedAt: new Date().toISOString() })
    .where(eq(researchFacts.id, loserFactId))
    .run();
}
