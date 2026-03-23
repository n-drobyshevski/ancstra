import 'dotenv/config';
import path from 'path';
import os from 'os';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './family-schema';
import * as centralSchema from './central-schema';

export function isWebMode(url?: string): boolean {
  return (url || '').startsWith('libsql://');
}

function resolveUrl(url: string): { url: string; authToken?: string } {
  if (url.startsWith('libsql://')) {
    // Use HTTPS transport for serverless compatibility (Vercel);
    // also trim the auth token — trailing whitespace makes it an invalid HTTP header
    const httpsUrl = url.replace('libsql://', 'https://');
    return { url: httpsUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() };
  }
  if (url.startsWith('file:')) return { url };
  const absPath = path.isAbsolute(url) ? url : path.resolve(url);
  return { url: `file:${absPath}` };
}

export function createDb(url?: string) {
  const dbUrl = url || process.env.DATABASE_URL || './ancstra.db';
  const client = createClient(resolveUrl(dbUrl));
  return drizzle({ client, schema });
}

export function createCentralDb(url?: string) {
  const dbUrl = url || process.env.CENTRAL_DATABASE_URL || path.join(os.homedir(), '.ancstra', 'ancstra.sqlite');
  const client = createClient(resolveUrl(dbUrl));
  return drizzle({ client, schema: centralSchema });
}

export function createFamilyDb(dbFilename: string) {
  let dbUrl: string;
  if (dbFilename.startsWith('libsql://') || dbFilename.startsWith('file:')) {
    dbUrl = dbFilename;
  } else {
    dbUrl = path.join(os.homedir(), '.ancstra', 'families', dbFilename);
  }
  const client = createClient(resolveUrl(dbUrl));
  return drizzle({ client, schema });
}

export type CentralDatabase = ReturnType<typeof createCentralDb>;
export type FamilyDatabase = ReturnType<typeof createFamilyDb>;

/**
 * Initialise FTS5 full-text search on person_names.
 * Creates the virtual table, auto-sync triggers, and rebuilds the index.
 * Only works in local mode (better-sqlite3); skipped for Turso/web mode.
 */
export function initFts5(url?: string) {
  const dbPath = url || process.env.DATABASE_URL || './ancstra.db';
  if (isWebMode(dbPath)) {
    console.warn('FTS5 init skipped in web mode');
    return;
  }

  // Dynamic require for local-only FTS5 init (better-sqlite3 is a dev/optional dependency)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 = require('better-sqlite3');
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
export * from './quality-queries';
export { rebuildClosureTable, addChildToFamily, removeChildFromFamily } from './closure-table';
