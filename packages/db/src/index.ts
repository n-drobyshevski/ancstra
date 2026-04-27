import 'dotenv/config';
import path from 'path';
import os from 'os';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { createLogger } from '@ancstra/shared';
import * as schema from './family-schema';
import * as centralSchema from './central-schema';

const log = createLogger('db');

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

const _ensuredDbs = new Set<string>();

/**
 * Ensure critical denormalized tables exist in a family database.
 * Safe to call on every request — uses IF NOT EXISTS and caches per process.
 * Needed because these tables were added after initial migrations.
 */
export async function ensureFamilySchema(db: FamilyDatabase, dbKey?: string): Promise<void> {
  if (dbKey && _ensuredDbs.has(dbKey)) return;

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS ancestor_paths (
      ancestor_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      descendant_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      depth INTEGER NOT NULL,
      PRIMARY KEY (ancestor_id, descendant_id)
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_ap_descendant ON ancestor_paths(descendant_id, depth)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_ap_ancestor ON ancestor_paths(ancestor_id, depth)`);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS factsheets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      entity_type TEXT NOT NULL DEFAULT 'person'
        CHECK (entity_type IN ('person', 'couple', 'family_unit')),
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'ready', 'promoted', 'merged', 'dismissed')),
      notes TEXT,
      promoted_person_id TEXT REFERENCES persons(id),
      promoted_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheets_status ON factsheets(status)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheets_created_by ON factsheets(created_by)`);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS factsheet_links (
      id TEXT PRIMARY KEY,
      from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
      to_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL
        CHECK (relationship_type IN ('parent_child', 'spouse', 'sibling')),
      source_fact_id TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium'
        CHECK (confidence IN ('high', 'medium', 'low')),
      created_at TEXT NOT NULL
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheet_links_from ON factsheet_links(from_factsheet_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheet_links_to ON factsheet_links(to_factsheet_id)`);

  // Persisted React Flow handle attachment columns (added 2026-04 — see
  // factsheet-graph-view.tsx). Older DBs predate these columns, so we ALTER.
  try {
    await db.run(sql`ALTER TABLE factsheet_links ADD COLUMN source_handle TEXT`);
  } catch { /* column already exists */ }
  try {
    await db.run(sql`ALTER TABLE factsheet_links ADD COLUMN target_handle TEXT`);
  } catch { /* column already exists */ }

  // Add factsheet columns to research_facts if not present
  try {
    await db.run(sql`ALTER TABLE research_facts ADD COLUMN factsheet_id TEXT REFERENCES factsheets(id)`);
  } catch { /* column already exists */ }
  try {
    await db.run(sql`ALTER TABLE research_facts ADD COLUMN accepted INTEGER`);
  } catch { /* column already exists */ }
  try {
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_research_facts_factsheet ON research_facts(factsheet_id)`);
  } catch { /* index already exists */ }

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS person_summary (
      person_id TEXT PRIMARY KEY REFERENCES persons(id) ON DELETE CASCADE,
      given_name TEXT NOT NULL DEFAULT '',
      surname TEXT NOT NULL DEFAULT '',
      sex TEXT NOT NULL,
      is_living INTEGER NOT NULL,
      birth_date TEXT,
      death_date TEXT,
      birth_date_sort INTEGER,
      death_date_sort INTEGER,
      birth_place TEXT,
      death_place TEXT,
      spouse_count INTEGER NOT NULL DEFAULT 0,
      child_count INTEGER NOT NULL DEFAULT 0,
      parent_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `);

  // Dashboard performance indexes (added 2026-04). Existing DBs predate these
  // — created here idempotently so cold-cache loads don't full-scan persons/families/events.
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_persons_deleted_created ON persons(deleted_at, created_at)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_families_deleted ON families(deleted_at)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_events_person_type ON events(person_id, event_type)`);

  // FTS5 full-text search on person_names — works on all backends (local + Turso)
  await db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS persons_fts USING fts5(
      given_name, surname,
      content=person_names,
      content_rowid=rowid
    )
  `);
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS persons_fts_ai AFTER INSERT ON person_names BEGIN
      INSERT INTO persons_fts(rowid, given_name, surname)
        VALUES (new.rowid, new.given_name, new.surname);
    END
  `);
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS persons_fts_ad AFTER DELETE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
        VALUES ('delete', old.rowid, old.given_name, old.surname);
    END
  `);
  await db.run(sql`
    CREATE TRIGGER IF NOT EXISTS persons_fts_au AFTER UPDATE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
        VALUES ('delete', old.rowid, old.given_name, old.surname);
      INSERT INTO persons_fts(rowid, given_name, surname)
        VALUES (new.rowid, new.given_name, new.surname);
    END
  `);
  // Only rebuild FTS index if it's empty (table was just created).
  // Triggers keep it in sync after that. Avoids expensive full scan on every cold start.
  const [ftsCount] = await db.all<{ n: number }>(
    sql`SELECT count(*) AS n FROM persons_fts LIMIT 1`,
  );
  if (ftsCount && ftsCount.n === 0) {
    log.info('FTS5 index empty — rebuilding from person_names');
    await db.run(sql`INSERT INTO persons_fts(persons_fts) VALUES('rebuild')`);
  }

  if (dbKey) _ensuredDbs.add(dbKey);
}

export type CentralDatabase = ReturnType<typeof createCentralDb>;
export type FamilyDatabase = ReturnType<typeof createFamilyDb>;

/**
 * Legacy FTS5 init via better-sqlite3 (local mode only).
 * In production, FTS5 is now initialised via ensureFamilySchema() which
 * works on all backends including Turso. This function is kept for the
 * CLI seed/migration path where better-sqlite3 is available.
 */
export function initFts5(url?: string) {
  const dbPath = url || process.env.DATABASE_URL || './ancstra.db';
  if (isWebMode(dbPath)) {
    log.info('FTS5 init skipped in web mode');
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

/**
 * Set WAL mode and busy timeout for local SQLite databases.
 * Only works in local mode (better-sqlite3); skipped for Turso/web mode.
 */
export function initLocalPragmas(url?: string) {
  const dbPath = url || process.env.DATABASE_URL || './ancstra.db';
  if (isWebMode(dbPath)) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 = require('better-sqlite3');
  const raw = new BetterSqlite3(dbPath);
  try {
    raw.pragma('journal_mode = WAL');
    raw.pragma('busy_timeout = 5000');
    log.info('WAL mode and busy_timeout set');
  } finally {
    raw.close();
  }
}

export type Database = ReturnType<typeof createDb>;
export * from './family-schema';
export * as centralSchema from './central-schema';
export * from './quality-queries';
export { rebuildClosureTable, addChildToFamily, removeChildFromFamily } from './closure-table';
export { rebuildAllSummaries, refreshSummary, refreshRelatedSummaries } from './person-summary';
export { backupDatabase, pruneBackups, restoreDatabase } from './backup';
