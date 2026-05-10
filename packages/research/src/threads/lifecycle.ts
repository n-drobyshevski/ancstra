import { eq } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import { addEvent } from './events';

async function transition(
  db: Database,
  threadId: string,
  actorId: string,
  toStatus: 'paused' | 'resolved' | 'abandoned',
  eventType: 'thread_paused' | 'thread_resolved' | 'thread_abandoned',
  reason?: string,
) {
  const now = new Date().toISOString();
  const closedAt = toStatus === 'paused' ? null : now;
  await db.update(researchThreads)
    .set({ status: toStatus, updatedAt: now, closedAt })
    .where(eq(researchThreads.id, threadId))
    .run();
  await addEvent(db, { threadId, eventType, actorId, reason });
}

export const pauseThread = (db: Database, threadId: string, actorId: string) =>
  transition(db, threadId, actorId, 'paused', 'thread_paused');

export const resolveThread = (db: Database, threadId: string, actorId: string, reason?: string) =>
  transition(db, threadId, actorId, 'resolved', 'thread_resolved', reason);

export const abandonThread = (db: Database, threadId: string, actorId: string, reason?: string) =>
  transition(db, threadId, actorId, 'abandoned', 'thread_abandoned', reason);
