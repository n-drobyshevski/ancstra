import { eq, sql } from 'drizzle-orm';
import { factsheets, factsheetLinks, researchThreadEvents, researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export interface CascadeInput {
  threadId: string | null;
  sourceFactsheetId: string;
  sourceFactId: string;
  newFactsheetTitle: string;
  relationshipType: 'parent_child' | 'spouse' | 'sibling';
  reason: string;
  actorId: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface CascadeResult {
  factsheetId: string;
  linkId: string;
  eventsEmitted: number;
}

/**
 * Atomic transactional cascade — creates a new factsheet linked to an existing one,
 * with optional thread event emission.
 *
 * Per project memory `feedback_drizzle_transactions.md`, uses raw BEGIN/COMMIT/ROLLBACK
 * (Drizzle's db.transaction(async tx) breaks on better-sqlite3).
 */
export async function cascade(db: Database, input: CascadeInput): Promise<CascadeResult> {
  // Application-level FK prechecks
  const srcRows = await db.select({ id: factsheets.id })
    .from(factsheets).where(eq(factsheets.id, input.sourceFactsheetId)).all();
  if (srcRows.length === 0) {
    throw new Error(`Source factsheet ${input.sourceFactsheetId} not found`);
  }

  if (input.threadId) {
    const threadRows = await db.select({ id: researchThreads.id })
      .from(researchThreads).where(eq(researchThreads.id, input.threadId)).all();
    if (threadRows.length === 0) {
      throw new Error(`Thread ${input.threadId} not found`);
    }
  }

  const newFactsheetId = crypto.randomUUID();
  const newLinkId = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.run(sql`BEGIN`);
  try {
    await db.insert(factsheets).values({
      id: newFactsheetId,
      title: input.newFactsheetTitle,
      entityType: 'person',
      status: 'draft',
      createdThreadId: input.threadId,
      createdBy: input.actorId,
      createdAt: now,
      updatedAt: now,
    }).run();

    await db.insert(factsheetLinks).values({
      id: newLinkId,
      fromFactsheetId: input.sourceFactsheetId,
      toFactsheetId: newFactsheetId,
      relationshipType: input.relationshipType,
      sourceFactId: input.sourceFactId,
      confidence: input.confidence ?? 'medium',
      createdAt: now,
    }).run();

    let eventsEmitted = 0;
    if (input.threadId) {
      const eventConfigs: Array<{
        eventType: 'factsheet_created' | 'factsheet_linked' | 'mention_followed';
        factsheetId?: string;
        linkId?: string;
        researchFactId?: string;
      }> = [
        { eventType: 'factsheet_created', factsheetId: newFactsheetId },
        { eventType: 'factsheet_linked',  factsheetId: newFactsheetId, linkId: newLinkId },
        { eventType: 'mention_followed',  factsheetId: newFactsheetId, researchFactId: input.sourceFactId, linkId: newLinkId },
      ];
      for (const e of eventConfigs) {
        await db.insert(researchThreadEvents).values({
          id: crypto.randomUUID(),
          threadId: input.threadId,
          eventType: e.eventType,
          actorId: input.actorId,
          factsheetId: e.factsheetId ?? null,
          linkId: e.linkId ?? null,
          researchFactId: e.researchFactId ?? null,
          reason: input.reason,
          payloadJson: null,
          occurredAt: now,
        }).run();
        eventsEmitted += 1;
      }
      await db.update(researchThreads)
        .set({ updatedAt: now })
        .where(eq(researchThreads.id, input.threadId))
        .run();
    }

    await db.run(sql`COMMIT`);
    return { factsheetId: newFactsheetId, linkId: newLinkId, eventsEmitted };
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }
}
