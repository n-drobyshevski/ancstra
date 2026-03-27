import { factsheetLinks } from '@ancstra/db';
import type { Database } from '@ancstra/db';

export async function listAllFactsheetLinks(db: Database) {
  return db.select().from(factsheetLinks).all();
}
