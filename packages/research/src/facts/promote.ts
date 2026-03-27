import { eq, sql } from 'drizzle-orm';
import { researchItems, researchFacts, factsheets } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import { createFactsheet, assignFactToFactsheet } from '../factsheets/queries';
import { promoteSingleFactsheet } from '../factsheets/promote';

export interface PromoteInput {
  researchItemId: string;
  personId: string;
  userId: string;
  citationText?: string;
}

export interface PromoteResult {
  factsheetId: string;
  personId: string;
  eventsCreated: number;
  sourcesCreated: number;
  mode: 'created' | 'merged';
}

/**
 * Promotes a research item by auto-creating a factsheet from its facts,
 * then promoting that factsheet into the tree.
 *
 * This is the convenience wrapper for the simple case: "I found a record
 * for an existing person, just add it as a source." Internally it routes
 * through the factsheet pipeline so there's a single promotion pathway.
 *
 * Throws if the item doesn't exist or is already promoted.
 */
export async function promoteToSource(db: Database, input: PromoteInput): Promise<PromoteResult> {
  // 1. Fetch and validate research item
  const items = await db
    .select()
    .from(researchItems)
    .where(eq(researchItems.id, input.researchItemId))
    .all();
  const item = items[0];

  if (!item) {
    throw new Error(`Research item not found: ${input.researchItemId}`);
  }

  if (item.status === 'promoted') {
    throw new Error(`Research item already promoted: ${input.researchItemId}`);
  }

  // 2. Auto-create a factsheet from the research item
  const factsheet = await createFactsheet(db, {
    title: item.title,
    entityType: 'person',
    createdBy: input.userId,
  });

  // 3. Assign all facts from this research item to the factsheet
  const facts = await db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.researchItemId, input.researchItemId))
    .all();

  for (const fact of facts) {
    await assignFactToFactsheet(db, fact.id, factsheet.id);
  }

  // 4. Promote via factsheet pipeline (merge into existing person).
  //    skipValidation: this is an auto-created factsheet from a convenience
  //    wrapper, so we trust the caller and skip the promotability gate.
  const result = await promoteSingleFactsheet(db, {
    factsheetId: factsheet.id,
    mode: 'merge',
    mergeTargetPersonId: input.personId,
    userId: input.userId,
    skipValidation: true,
  });

  return {
    factsheetId: factsheet.id,
    personId: result.personId,
    eventsCreated: result.eventsCreated,
    sourcesCreated: result.sourcesCreated,
    mode: result.mode,
  };
}
