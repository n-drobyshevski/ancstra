import { createFamilyDb, ensureFamilySchema, type FamilyDatabase } from '@ancstra/db';

/**
 * Create a family DB connection and ensure schema is up-to-date.
 * Use this instead of calling createFamilyDb directly in server components.
 */
export async function getFamilyDb(dbFilename: string): Promise<FamilyDatabase> {
  const db = createFamilyDb(dbFilename);
  await ensureFamilySchema(db, dbFilename);
  return db;
}
