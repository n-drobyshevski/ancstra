import { eq } from 'drizzle-orm';
import {
  researchItems,
  researchFacts,
  sources,
  sourceCitations,
} from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface PromoteInput {
  researchItemId: string;
  personId: string;
  userId: string;
  citationText?: string;
}

export interface PromoteResult {
  sourceId: string;
  sourceCitationId: string;
  factsUpdated: number;
}

/** Map provider IDs to source types. Falls back to 'online'. */
const PROVIDER_SOURCE_TYPE: Record<string, string> = {
  nara: 'military',
  chronicling_america: 'newspaper',
  familysearch: 'vital_record',
};

/**
 * Promotes a research item into a source + citation in a single transaction.
 * All facts linked to the item get their source_citation_id set.
 *
 * Throws if the item doesn't exist or is already promoted.
 * Rolls back all changes if any step fails.
 */
export function promoteToSource(db: Database, input: PromoteInput): PromoteResult {
  // 1. Fetch research item
  const [item] = db
    .select()
    .from(researchItems)
    .where(eq(researchItems.id, input.researchItemId))
    .all();

  if (!item) {
    throw new Error(`Research item not found: ${input.researchItemId}`);
  }

  if (item.status === 'promoted') {
    throw new Error(`Research item already promoted: ${input.researchItemId}`);
  }

  const sourceId = crypto.randomUUID();
  const citationId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 2. Run entire promotion as a single transaction.
  //    Drizzle's db.transaction() for better-sqlite3 is synchronous and
  //    automatically rolls back on thrown errors.
  let factsUpdated = 0;

  (db as any).transaction((tx: any) => {
    // a. INSERT source
    const sourceType = item.providerId
      ? PROVIDER_SOURCE_TYPE[item.providerId] ?? 'online'
      : 'online';

    tx.insert(sources)
      .values({
        id: sourceId,
        title: item.title,
        repositoryUrl: item.url ?? null,
        sourceType: sourceType as any,
        createdBy: input.userId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // b. INSERT source citation
    tx.insert(sourceCitations)
      .values({
        id: citationId,
        sourceId,
        personId: input.personId,
        citationText: input.citationText ?? null,
        confidence: 'medium',
        createdAt: now,
      })
      .run();

    // c. UPDATE facts linked to this research item
    const updateResult = tx.update(researchFacts)
      .set({ sourceCitationId: citationId, updatedAt: now })
      .where(eq(researchFacts.researchItemId, input.researchItemId))
      .run();

    factsUpdated = updateResult.changes;

    // d. UPDATE research item status
    tx.update(researchItems)
      .set({
        status: 'promoted' as const,
        promotedSourceId: sourceId,
        updatedAt: now,
      })
      .where(eq(researchItems.id, input.researchItemId))
      .run();
  });

  return { sourceId, sourceCitationId: citationId, factsUpdated };
}
