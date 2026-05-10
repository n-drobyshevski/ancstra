import { eq } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { CreateThreadInput } from './types';

export async function createThread(db: Database, input: CreateThreadInput) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(researchThreads).values({
    id,
    title: input.title,
    status: 'active',
    seedPersonId: input.seedPersonId ?? null,
    seedFactsheetId: input.seedFactsheetId ?? null,
    seedResearchItemId: input.seedResearchItemId ?? null,
    summary: input.summary ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  }).run();
  const rows = await db.select().from(researchThreads).where(eq(researchThreads.id, id)).all();
  return rows[0];
}
