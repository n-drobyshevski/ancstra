import 'dotenv/config';
import path from 'path';
import os from 'os';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import * as schema from './family-schema';
import * as centralSchema from './central-schema';

export function createDb(url?: string) {
  return drizzle({
    connection: { source: url || process.env.DATABASE_URL || './ancstra.db' },
    schema,
  });
}

export function createCentralDb(url?: string) {
  const defaultPath = path.join(os.homedir(), '.ancstra', 'ancstra.sqlite');
  return drizzle({
    connection: { source: url || process.env.CENTRAL_DATABASE_URL || defaultPath },
    schema: centralSchema,
  });
}

export function createFamilyDb(dbFilename: string) {
  const familiesDir = path.join(os.homedir(), '.ancstra', 'families');
  return drizzle({
    connection: { source: path.join(familiesDir, dbFilename) },
    schema,
  });
}

export type CentralDatabase = ReturnType<typeof createCentralDb>;
export type FamilyDatabase = ReturnType<typeof createFamilyDb>;

/**
 * Initialise FTS5 full-text search on person_names.
 * Creates the virtual table, auto-sync triggers, and rebuilds the index.
 */
export function initFts5(url?: string) {
  const dbPath = url || process.env.DATABASE_URL || './ancstra.db';
  const raw = new BetterSqlite3(dbPath);

  try {
    raw.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS persons_fts USING fts5(
        given_name, surname,
        content=person_names,
        content_rowid=rowid
      );
    `);

    raw.exec(`
      DROP TRIGGER IF EXISTS persons_fts_ai;
      CREATE TRIGGER persons_fts_ai AFTER INSERT ON person_names BEGIN
        INSERT INTO persons_fts(rowid, given_name, surname)
          VALUES (new.rowid, new.given_name, new.surname);
      END;

      DROP TRIGGER IF EXISTS persons_fts_ad;
      CREATE TRIGGER persons_fts_ad AFTER DELETE ON person_names BEGIN
        INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
          VALUES ('delete', old.rowid, old.given_name, old.surname);
      END;

      DROP TRIGGER IF EXISTS persons_fts_au;
      CREATE TRIGGER persons_fts_au AFTER UPDATE ON person_names BEGIN
        INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
          VALUES ('delete', old.rowid, old.given_name, old.surname);
        INSERT INTO persons_fts(rowid, given_name, surname)
          VALUES (new.rowid, new.given_name, new.surname);
      END;
    `);

    raw.exec(`INSERT INTO persons_fts(persons_fts) VALUES('rebuild');`);
  } finally {
    raw.close();
  }
}

export type Database = ReturnType<typeof createDb>;
export * from './family-schema';
export * as centralSchema from './central-schema';
