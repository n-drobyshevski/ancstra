'use server';

import { createDb, events } from '@ancstra/db';
import { auth } from '@/auth';
import { getTreeData } from '@/lib/queries';
import { serializeToGedcom } from '@/lib/gedcom/serialize';
import type { ExportMode } from '@/lib/gedcom/serialize';

// ---------------------------------------------------------------------------
// exportGedcom — serialize entire tree to GEDCOM 5.5.1 string
// ---------------------------------------------------------------------------
export async function exportGedcom(formData: FormData): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const mode = (formData.get('mode') as ExportMode) || 'full';

  const db = createDb();
  const { persons, families, childLinks } = getTreeData(db);

  const allEvents = await db.select().from(events).all();

  return serializeToGedcom({ persons, families, childLinks, events: allEvents }, mode);
}
