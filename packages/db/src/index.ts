import 'dotenv/config';
import path from 'path';
import os from 'os';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { createLogger } from '@ancstra/shared';
import * as schema from './family-schema';
import * as centralSchema from './central-schema';
import { wrapWithSlowQueryLogger } from './perf/slow-query-logger';

const log = createLogger('db');

/** Returns true when the slow-query Proxy should be applied. */
function shouldWrapSlowQuery(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.PERF_SLOW_QUERY_ENABLED === '1'
  );
}

/** Create (and optionally wrap) a libsql client. */
function makeClient(config: Parameters<typeof createClient>[0]) {
  const client = createClient(config);
  return shouldWrapSlowQuery() ? wrapWithSlowQueryLogger(client) : client;
}

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
  const client = makeClient(resolveUrl(dbUrl));
  return drizzle({ client, schema });
}

export function createCentralDb(url?: string) {
  const dbUrl = url || process.env.CENTRAL_DATABASE_URL || path.join(os.homedir(), '.ancstra', 'ancstra.sqlite');
  const client = makeClient(resolveUrl(dbUrl));
  return drizzle({ client, schema: centralSchema });
}

export function createFamilyDb(dbFilename: string) {
  let dbUrl: string;
  if (dbFilename.startsWith('libsql://') || dbFilename.startsWith('file:')) {
    dbUrl = dbFilename;
  } else {
    dbUrl = path.join(os.homedir(), '.ancstra', 'families', dbFilename);
  }
  const client = makeClient(resolveUrl(dbUrl));
  return drizzle({ client, schema });
}

// Map<dbKey, in-flight ensureFamilySchema promise> — coalesces concurrent
// callers so we don't double-run rebuildAllSummaries. Set-based caching
// only added the dbKey *after* the body finished, so two parallel callers
// (e.g., dashboard slot + family.listMine after a fresh signup) both passed
// the early-return check and both ran the rebuild, racing to INSERT into
// person_summary and tripping the UNIQUE(person_id) index on the loser.
//
// On rejection we delete the entry so the next request can retry — caching a
// failed promise would permanently break the family for this process.
const _ensuredDbs = new Map<string, Promise<void>>();

/**
 * Ensure critical denormalized tables exist in a family database.
 * Safe to call on every request — uses IF NOT EXISTS and caches per process.
 * Needed because these tables were added after initial migrations.
 */
export async function ensureFamilySchema(db: FamilyDatabase, dbKey?: string): Promise<void> {
  if (!dbKey) {
    return ensureFamilySchemaInner(db);
  }
  const existing = _ensuredDbs.get(dbKey);
  if (existing) return existing;
  const promise = ensureFamilySchemaInner(db).catch((err) => {
    _ensuredDbs.delete(dbKey);
    throw err;
  });
  _ensuredDbs.set(dbKey, promise);
  return promise;
}

async function ensureFamilySchemaInner(db: FamilyDatabase): Promise<void> {

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

  // Bundle A 2026-05-23: factsheet_links gains 'partner' relationship_type,
  // 'unknown' confidence band, and orthogonal `contested` boolean. The
  // legacy ALTERs for source_handle/target_handle are subsumed by this
  // CREATE TABLE — legacy DBs predating those columns will still have them
  // because ensureFamilySchemaInner ran the ALTERs on a prior cold start
  // before this code shipped. The recreate-if-no-partner block below also
  // preserves them on copy.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS factsheet_links (
      id TEXT PRIMARY KEY,
      from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
      to_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
      relationship_type TEXT NOT NULL
        CHECK (relationship_type IN ('parent_child', 'spouse', 'partner', 'sibling')),
      source_fact_id TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium'
        CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
      contested INTEGER NOT NULL DEFAULT 0,
      source_handle TEXT,
      target_handle TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (from_factsheet_id, to_factsheet_id, relationship_type)
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheet_links_from ON factsheet_links(from_factsheet_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheet_links_to ON factsheet_links(to_factsheet_id)`);

  // Bundle A 2026-05-23: existing DBs predate the partner/contested expansion.
  // SQLite has no ALTER CHECK — rename-old, create-new, copy-data, drop-old.
  try {
    await db.run(sql`ALTER TABLE factsheet_links ADD COLUMN contested INTEGER NOT NULL DEFAULT 0`);
  } catch { /* column already exists */ }

  const [linksRow] = await db.all<{ sql: string }>(
    sql`SELECT sql FROM sqlite_master WHERE type='table' AND name='factsheet_links'`,
  );
  if (linksRow && !linksRow.sql.includes("'partner'")) {
    await db.run(sql`PRAGMA foreign_keys = OFF`);
    await db.run(sql`ALTER TABLE factsheet_links RENAME TO __old_factsheet_links`);
    await db.run(sql`
      CREATE TABLE factsheet_links (
        id TEXT PRIMARY KEY,
        from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
        to_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
        relationship_type TEXT NOT NULL
          CHECK (relationship_type IN ('parent_child', 'spouse', 'partner', 'sibling')),
        source_fact_id TEXT,
        confidence TEXT NOT NULL DEFAULT 'medium'
          CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
        contested INTEGER NOT NULL DEFAULT 0,
        source_handle TEXT,
        target_handle TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (from_factsheet_id, to_factsheet_id, relationship_type)
      )
    `);
    await db.run(sql`
      INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, source_fact_id, confidence, contested, source_handle, target_handle, created_at)
      SELECT id, from_factsheet_id, to_factsheet_id, relationship_type, source_fact_id,
             confidence, COALESCE(contested, 0), source_handle, target_handle, created_at
      FROM __old_factsheet_links
    `);
    await db.run(sql`DROP TABLE __old_factsheet_links`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheet_links_from ON factsheet_links(from_factsheet_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheet_links_to ON factsheet_links(to_factsheet_id)`);
    await db.run(sql`PRAGMA foreign_keys = ON`);
  }

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

  // Research Threads Phase 1 (2026-05): link factsheets back to the thread
  // that spawned them. Nullable — factsheets created before threads existed
  // have no thread.
  try {
    await db.run(sql`ALTER TABLE factsheets ADD COLUMN created_thread_id TEXT`);
  } catch { /* column already exists */ }
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_factsheets_thread ON factsheets(created_thread_id)`);

  // Research Threads + Thread Events tables — mirror of migration 0009
  // (0009_parallel_stingray.sql). Existing dev DBs predate that migration; without
  // these back-fill CREATE TABLEs, POST /api/research/threads 500s with
  // "no such table: research_threads".
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS research_threads (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      seed_person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      seed_factsheet_id TEXT REFERENCES factsheets(id) ON DELETE SET NULL,
      seed_research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
      summary TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_threads_status ON research_threads(status)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_threads_created_by ON research_threads(created_by)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_threads_updated_at ON research_threads(updated_at)`);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS research_thread_events (
      id TEXT PRIMARY KEY NOT NULL,
      thread_id TEXT NOT NULL REFERENCES research_threads(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      factsheet_id TEXT REFERENCES factsheets(id) ON DELETE SET NULL,
      person_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      research_item_id TEXT REFERENCES research_items(id) ON DELETE SET NULL,
      research_fact_id TEXT REFERENCES research_facts(id) ON DELETE SET NULL,
      source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
      link_id TEXT REFERENCES factsheet_links(id) ON DELETE SET NULL,
      reason TEXT,
      payload_json TEXT,
      occurred_at TEXT NOT NULL
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_thread_events_thread ON research_thread_events(thread_id, occurred_at)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_thread_events_factsheet ON research_thread_events(factsheet_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_thread_events_person ON research_thread_events(person_id)`);

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
      has_name INTEGER NOT NULL DEFAULT 0,
      has_birth_event INTEGER NOT NULL DEFAULT 0,
      has_birth_place INTEGER NOT NULL DEFAULT 0,
      has_death_event INTEGER NOT NULL DEFAULT 0,
      has_source INTEGER NOT NULL DEFAULT 0,
      sources_count INTEGER NOT NULL DEFAULT 0,
      completeness INTEGER NOT NULL DEFAULT 0,
      validation TEXT NOT NULL DEFAULT 'confirmed',
      updated_at_sort TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  // Facet columns added 2026-04 — older DBs predate them, so ALTER idempotently.
  // SQLite throws when a column already exists; the try/catch swallows that.
  for (const col of [
    'has_name INTEGER NOT NULL DEFAULT 0',
    'has_birth_event INTEGER NOT NULL DEFAULT 0',
    'has_birth_place INTEGER NOT NULL DEFAULT 0',
    'has_death_event INTEGER NOT NULL DEFAULT 0',
    'has_source INTEGER NOT NULL DEFAULT 0',
    'sources_count INTEGER NOT NULL DEFAULT 0',
    'completeness INTEGER NOT NULL DEFAULT 0',
    "validation TEXT NOT NULL DEFAULT 'confirmed'",
    'updated_at_sort TEXT',
  ]) {
    try {
      await db.run(sql.raw(`ALTER TABLE person_summary ADD COLUMN ${col}`));
    } catch { /* column already exists */ }
  }
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_person_summary_validation ON person_summary(validation)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_person_summary_completeness ON person_summary(completeness)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_person_summary_birth_sort ON person_summary(birth_date_sort)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_person_summary_death_sort ON person_summary(death_date_sort)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_person_summary_sources_count ON person_summary(sources_count)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_person_summary_updated_sort ON person_summary(updated_at_sort)`);

  // One-time facet backfill after schema upgrade. Tracked via _ancstra_meta so
  // we don't rebuild on every cold start.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS _ancstra_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  const [versionRow] = await db.all<{ value: string }>(
    sql`SELECT value FROM _ancstra_meta WHERE key = 'person_summary_facets_version'`,
  );
  const currentVersion = versionRow?.value ?? '0';
  if (currentVersion < '1') {
    log.info('person_summary facets out of date — running rebuildAllSummaries');
    const { rebuildAllSummaries } = await import('./person-summary');
    await rebuildAllSummaries(db);
    await db.run(sql`
      INSERT OR REPLACE INTO _ancstra_meta(key, value)
      VALUES ('person_summary_facets_version', '1')
    `);
  }

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
}

const _ensuredCentralDbs = new Set<string>();

/**
 * Ensure central-DB schema additions are present.
 * Idempotent: safe to call on every request — uses ALTER ... IF NOT EXISTS-equivalent
 * try/catch and CREATE INDEX IF NOT EXISTS. Process-cached per dbKey.
 *
 * Mirrors ensureFamilySchema() above. Used for additive schema changes that were
 * introduced after initial deployments (which were initialized via drizzle-kit push).
 */
export async function ensureCentralSchema(db: CentralDatabase, dbKey?: string): Promise<void> {
  if (dbKey && _ensuredCentralDbs.has(dbKey)) return;

  // Sub-spec A 2026-04-30: JWT staleness counter on users table
  try {
    await db.run(sql`ALTER TABLE users ADD COLUMN memberships_version INTEGER NOT NULL DEFAULT 0`);
  } catch { /* column already exists */ }

  // Sub-spec A 2026-04-30: DB-enforce single owner per family
  await db.run(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_family_members_family_owner
      ON family_members (family_id) WHERE role = 'owner'
  `);

  // Platform-admin v1 2026-05-01: cross-family super-admin flag
  try {
    await db.run(sql`ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0`);
  } catch { /* column already exists */ }

  // Platform-admin v1 2026-05-01: audit trail for platform-level actions.
  // Separate from activity_feed which requires NOT NULL family_id.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS platform_audit_log (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_platform_audit_actor_date ON platform_audit_log(actor_user_id, created_at)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_platform_audit_target ON platform_audit_log(target_type, target_id)`);

  // Per-user preferences (Phase 1 of role-specific settings, 2026-05-08).
  // Every authenticated user owns their own row; no role gating applied.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      locale TEXT NOT NULL DEFAULT 'en-US',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      density TEXT NOT NULL DEFAULT 'comfortable' CHECK(density IN ('comfortable', 'compact')),
      notify_email INTEGER NOT NULL DEFAULT 1,
      notify_activity INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Editor defaults (Phase 3 of role-specific settings, 2026-05-08). ALTER for
  // existing DBs; new DBs pick these up via the schema default in their initial
  // CREATE TABLE elsewhere.
  for (const col of [
    "default_privacy_level TEXT NOT NULL DEFAULT 'private'",
    "default_gedcom_export_mode TEXT NOT NULL DEFAULT 'shareable'",
    "default_citation_style TEXT NOT NULL DEFAULT 'evidence-explained'",
    'living_threshold_years INTEGER NOT NULL DEFAULT 100',
  ]) {
    try {
      await db.run(sql.raw(`ALTER TABLE family_registry ADD COLUMN ${col}`));
    } catch { /* column already exists */ }
  }

  // Experimental features gating (2026-05-09). Per-user opt-in columns plus
  // platform-wide policy singleton. See packages/auth/src/experimental.ts.
  // Tree visualization preferences (2026-05-09): per-user toggle for
  // anti-overlap behavior on node-style mode switch.
  for (const col of [
    'experimental_enabled INTEGER NOT NULL DEFAULT 0',
    "experimental_features TEXT NOT NULL DEFAULT '{}'",
    'tree_auto_spread INTEGER NOT NULL DEFAULT 1',
    'tree_genealogical_ordering INTEGER NOT NULL DEFAULT 1',
  ]) {
    try {
      await db.run(sql.raw(`ALTER TABLE user_preferences ADD COLUMN ${col}`));
    } catch { /* column already exists */ }
  }

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id TEXT PRIMARY KEY DEFAULT 'global',
      experimental_features_allow_users INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT REFERENCES users(id)
    )
  `);
  // Seed the singleton row. INSERT OR IGNORE so it's safe on every cold start.
  await db.run(sql`INSERT OR IGNORE INTO platform_settings (id) VALUES ('global')`);

  // Soft-delete columns for platform-admin delete action (2026-05-10).
  // Read paths must filter `deleted_at IS NULL`. Idempotent ALTER —
  // throws "duplicate column" on re-run, which we swallow.
  try {
    await db.run(sql`ALTER TABLE users ADD COLUMN deleted_at TEXT`);
  } catch { /* column already exists */ }
  try {
    await db.run(sql`ALTER TABLE family_registry ADD COLUMN deleted_at TEXT`);
  } catch { /* column already exists */ }

  if (dbKey) _ensuredCentralDbs.add(dbKey);
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
export * from './vocab';
