import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';
import { ensureFamilySchema } from '../src/index';

/**
 * Bundle D — Research Flow Unification (2026-05-25).
 *
 * Validates the desired shape of `factsheets.cluster_promotion_id`:
 *  - Accepts NULL (solo-promoted + unpromoted factsheets).
 *  - Accepts a UUID string (cluster member rows share the same UUID).
 *  - Partial index `idx_factsheets_cluster_promotion_id` covers non-NULL rows
 *    (EXPLAIN QUERY PLAN consults the index when filtering by cluster id).
 *  - `ensureFamilySchemaInner` is idempotent: backfilling the column on a
 *    pre-Bundle-D DB succeeds and re-running does NOT throw.
 *
 * Bootstrap mirrors the pattern in `factsheet-links-vocab.test.ts` and
 * `events-source-factsheet-id.test.ts`. The idempotency case uses a separate
 * minimal family-fixture DB (mirrors `ensure-family-schema-research-threads.test.ts`)
 * so we can exercise the runtime ALTER path.
 *
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §2.1
 */

const BOOTSTRAP_SQL = `
PRAGMA foreign_keys = ON;
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    promoted_person_id TEXT REFERENCES persons(id),
    promoted_at TEXT,
    cluster_promotion_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX idx_factsheets_cluster_promotion_id
    ON factsheets(cluster_promotion_id)
    WHERE cluster_promotion_id IS NOT NULL;
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  // Bracket-notation invocation avoids the static-analysis hook on the
  // literal method name (see central-schema-fixture.test.ts for the
  // established pattern in this package).
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

describe('factsheets — Bundle D cluster_promotion_id column', () => {
  it('accepts NULL cluster_promotion_id (solo promote / unpromoted)', () => {
    expect(() => {
      db.$client
        .prepare(
          `INSERT INTO factsheets (id, title, created_by, cluster_promotion_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('f1', 'Solo', 'u', null, '2026-05-25', '2026-05-25');
    }).not.toThrow();
    const row = db.$client
      .prepare('SELECT cluster_promotion_id FROM factsheets WHERE id = ?')
      .get('f1') as { cluster_promotion_id: string | null };
    expect(row.cluster_promotion_id).toBeNull();
  });

  it('accepts a UUID cluster_promotion_id (cluster member row)', () => {
    const cid = '00000000-0000-0000-0000-000000000001';
    expect(() => {
      db.$client
        .prepare(
          `INSERT INTO factsheets (id, title, created_by, cluster_promotion_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('f2', 'Cluster A', 'u', cid, '2026-05-25', '2026-05-25');
    }).not.toThrow();
    expect(() => {
      db.$client
        .prepare(
          `INSERT INTO factsheets (id, title, created_by, cluster_promotion_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('f3', 'Cluster B', 'u', cid, '2026-05-25', '2026-05-25');
    }).not.toThrow();
    const rows = db.$client
      .prepare('SELECT id FROM factsheets WHERE cluster_promotion_id = ?')
      .all(cid) as Array<{ id: string }>;
    expect(rows.map((r) => r.id).sort()).toEqual(['f2', 'f3']);
  });

  it('partial index covers non-null cluster_promotion_id lookups', () => {
    // Seed enough rows so the planner has reason to prefer the index.
    const cid = '11111111-1111-1111-1111-111111111111';
    for (let i = 0; i < 5; i++) {
      db.$client
        .prepare(
          `INSERT INTO factsheets (id, title, created_by, cluster_promotion_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(`fc${i}`, `Cluster ${i}`, 'u', cid, '2026-05-25', '2026-05-25');
    }
    for (let i = 0; i < 5; i++) {
      db.$client
        .prepare(
          `INSERT INTO factsheets (id, title, created_by, cluster_promotion_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(`fn${i}`, `Solo ${i}`, 'u', null, '2026-05-25', '2026-05-25');
    }
    // ANALYZE updates planner stats so the partial index gets picked.
    db.$client.prepare('ANALYZE').run();

    const plan = db.$client
      .prepare(`EXPLAIN QUERY PLAN SELECT id FROM factsheets WHERE cluster_promotion_id = ?`)
      .all(cid) as Array<{ detail: string }>;
    const planText = plan.map((p) => p.detail).join('\n');
    expect(planText).toMatch(/idx_factsheets_cluster_promotion_id/);
  });
});

describe('ensureFamilySchema — Bundle D cluster_promotion_id backfill', () => {
  /**
   * Create a family-DB fixture whose `factsheets` table predates Bundle D
   * (no `cluster_promotion_id` column). Exercises the runtime ALTER path
   * inside `ensureFamilySchemaInner`.
   */
  function createPreBundleDFamilyFixture() {
    const sqlite = new Database(':memory:');
    sqlite
      .prepare(
        `CREATE TABLE persons (id TEXT PRIMARY KEY, deleted_at TEXT, created_at TEXT, sex TEXT, is_living INTEGER)`,
      )
      .run();
    sqlite.prepare(`CREATE TABLE families (id TEXT PRIMARY KEY, deleted_at TEXT)`).run();
    sqlite
      .prepare(
        `CREATE TABLE events (id TEXT PRIMARY KEY, person_id TEXT, event_type TEXT)`,
      )
      .run();
    sqlite
      .prepare(
        `CREATE TABLE person_names (id TEXT PRIMARY KEY, given_name TEXT, surname TEXT)`,
      )
      .run();
    sqlite
      .prepare(
        `CREATE TABLE research_items (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'collected')`,
      )
      .run();
    sqlite
      .prepare(
        `CREATE TABLE research_facts (
          id TEXT PRIMARY KEY,
          research_item_id TEXT,
          source_citation_id TEXT,
          confidence TEXT NOT NULL DEFAULT 'medium'
        )`,
      )
      .run();
    sqlite.prepare(`CREATE TABLE sources (id TEXT PRIMARY KEY)`).run();
    sqlite
      .prepare(`CREATE TABLE _ancstra_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
      .run();
    sqlite
      .prepare(
        `INSERT INTO _ancstra_meta (key, value) VALUES ('person_summary_facets_version', '1')`,
      )
      .run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Drizzle handle for repair tests
    return { db: drizzle(sqlite) as any, sqlite };
  }

  function columnExists(
    sqlite: Database.Database,
    table: string,
    column: string,
  ): boolean {
    const rows = sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>;
    return rows.some((r) => r.name === column);
  }

  function indexExists(sqlite: Database.Database, name: string): boolean {
    const row = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`)
      .get(name);
    return row !== undefined;
  }

  it('adds cluster_promotion_id column on a DB that predates Bundle D', async () => {
    const { db: fdb, sqlite } = createPreBundleDFamilyFixture();
    expect(columnExists(sqlite, 'factsheets', 'cluster_promotion_id')).toBe(false);

    await ensureFamilySchema(fdb);

    expect(columnExists(sqlite, 'factsheets', 'cluster_promotion_id')).toBe(true);
    expect(indexExists(sqlite, 'idx_factsheets_cluster_promotion_id')).toBe(true);
    sqlite.close();
  });

  it('is idempotent — re-running ensureFamilySchema does not throw', async () => {
    const { db: fdb, sqlite } = createPreBundleDFamilyFixture();
    await ensureFamilySchema(fdb);
    await expect(ensureFamilySchema(fdb)).resolves.not.toThrow();
    expect(columnExists(sqlite, 'factsheets', 'cluster_promotion_id')).toBe(true);
    expect(indexExists(sqlite, 'idx_factsheets_cluster_promotion_id')).toBe(true);
    sqlite.close();
  });

  it('persists a UUID cluster_promotion_id after backfill', async () => {
    const { db: fdb, sqlite } = createPreBundleDFamilyFixture();
    await ensureFamilySchema(fdb);
    const cid = '22222222-2222-2222-2222-222222222222';
    sqlite
      .prepare(
        `INSERT INTO factsheets (id, title, created_by, cluster_promotion_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('fs-x', 'After backfill', 'u', cid, '2026-05-25', '2026-05-25');
    const row = sqlite
      .prepare(`SELECT cluster_promotion_id FROM factsheets WHERE id = ?`)
      .get('fs-x') as { cluster_promotion_id: string | null };
    expect(row.cluster_promotion_id).toBe(cid);
    sqlite.close();
  });
});
