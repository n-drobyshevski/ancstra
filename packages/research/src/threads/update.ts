import { eq } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import type { UpdateThreadInput } from './types';

export async function updateThread(db: Database, threadId: string, patch: UpdateThreadInput) {
  const now = new Date().toISOString();
  const set: Record<string, string> = { updatedAt: now };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.summary !== undefined) set.summary = patch.summary;
  if (Object.keys(set).length === 1) return; // only updatedAt — skip
  await db.update(researchThreads).set(set).where(eq(researchThreads.id, threadId)).run();
}
