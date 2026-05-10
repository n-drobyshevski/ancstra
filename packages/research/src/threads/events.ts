import { eq, asc } from 'drizzle-orm';
import { researchThreads, researchThreadEvents } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { AddEventInput } from './types';

export async function addEvent(db: Database, input: AddEventInput) {
  // Application-level FK check (SQLite FK enforcement is opt-in)
  const exists = await db.select({ id: researchThreads.id })
    .from(researchThreads)
    .where(eq(researchThreads.id, input.threadId))
    .all();
  if (exists.length === 0) {
    throw new Error(`Thread ${input.threadId} not found`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(researchThreadEvents).values({
    id,
    threadId: input.threadId,
    eventType: input.eventType,
    actorId: input.actorId,
    factsheetId: input.factsheetId ?? null,
    personId: input.personId ?? null,
    researchItemId: input.researchItemId ?? null,
    researchFactId: input.researchFactId ?? null,
    sourceId: input.sourceId ?? null,
    linkId: input.linkId ?? null,
    reason: input.reason ?? null,
    payloadJson: input.payload === undefined ? null : JSON.stringify(input.payload),
    occurredAt: now,
  }).run();

  // Bump thread updatedAt so listings sort fresh threads up
  await db.update(researchThreads)
    .set({ updatedAt: now })
    .where(eq(researchThreads.id, input.threadId))
    .run();

  const rows = await db.select().from(researchThreadEvents)
    .where(eq(researchThreadEvents.id, id))
    .all();
  return rows[0];
}

export async function getThreadTimeline(db: Database, threadId: string, opts?: {
  limit?: number;
  offset?: number;
}) {
  const limit = opts?.limit ?? 200;
  const offset = opts?.offset ?? 0;
  return db.select().from(researchThreadEvents)
    .where(eq(researchThreadEvents.threadId, threadId))
    .orderBy(asc(researchThreadEvents.occurredAt))
    .limit(limit)
    .offset(offset)
    .all();
}
