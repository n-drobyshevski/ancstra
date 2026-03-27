import { eq } from 'drizzle-orm';
import { factsheets, factsheetLinks } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export async function batchDismissFactsheets(db: Database, ids: string[]) {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  for (const id of ids) {
    await db.update(factsheets)
      .set({ status: 'dismissed', updatedAt: now })
      .where(eq(factsheets.id, id))
      .run();
  }
}

export async function batchLinkFactsheets(
  db: Database,
  factsheetIds: string[],
  relationshipType: 'parent_child' | 'spouse' | 'sibling'
) {
  if (factsheetIds.length < 2) return;
  const now = new Date().toISOString();
  for (let i = 0; i < factsheetIds.length - 1; i++) {
    const id = crypto.randomUUID();
    await db.insert(factsheetLinks)
      .values({
        id,
        fromFactsheetId: factsheetIds[i],
        toFactsheetId: factsheetIds[i + 1],
        relationshipType,
        confidence: 'medium',
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();
  }
}
