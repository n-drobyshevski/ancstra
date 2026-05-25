import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { promoteFactsheetCluster } from '../../factsheets/promote';
import { getClusterMembership } from '../../factsheets/cluster';

/**
 * Bundle D 2026-05-25 — `promoteFactsheetCluster` stamps `cluster_promotion_id`
 * and is atomic across phase-1 (promote members) + phase-2 (wire families/children).
 *
 * Bootstrap mirrors the canonical pattern from `cluster.test.ts`.
 * All tables required by `_promoteSingleFactsheetInTransaction` and phase-2 are
 * included. The atomicity DDL variant omits DEFAULT on
 * `children.relationship_to_parent1` to make phase-2 fail with a NOT NULL
 * constraint — since phase-1 never writes to `children`, this cleanly tests
 * that the whole outer transaction is rolled back.
 */

// ---------------------------------------------------------------------------
// Normal DDL — used by the "stamps UUID" test (full happy-path schema).
// ---------------------------------------------------------------------------

const NORMAL_DDL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private',
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    name_type TEXT NOT NULL DEFAULT 'birth',
    prefix TEXT,
    given_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    suffix TEXT,
    nickname TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    source_factsheet_id TEXT,
    date_original TEXT,
    date_sort INTEGER,
    place_text TEXT,
    contested INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    repository_url TEXT,
    source_type TEXT NOT NULL DEFAULT 'other',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE source_citations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES sources(id),
    person_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL
  );
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT,
    discovery_method TEXT NOT NULL DEFAULT 'search',
    status TEXT NOT NULL DEFAULT 'collected',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    fact_date_sort INTEGER,
    factsheet_id TEXT,
    source_citation_id TEXT,
    research_item_id TEXT,
    accepted INTEGER,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    provenance TEXT NOT NULL DEFAULT 'derived',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    promoted_person_id TEXT REFERENCES persons(id),
    promoted_at TEXT,
    cluster_promotion_id TEXT,
    created_thread_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
    to_factsheet_id TEXT NOT NULL REFERENCES factsheets(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    source_fact_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    source_handle TEXT,
    target_handle TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE families (
    id TEXT PRIMARY KEY,
    partner1_id TEXT,
    partner2_id TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE children (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    child_order INTEGER,
    relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
    relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    factsheet_id TEXT,
    person_id TEXT,
    research_item_id TEXT,
    research_fact_id TEXT,
    source_id TEXT,
    link_id TEXT,
    reason TEXT,
    payload_json TEXT,
    occurred_at TEXT NOT NULL
  );
`;

// ---------------------------------------------------------------------------
// Atomicity DDL — `children.relationship_to_parent1` has NO DEFAULT and is
// NOT NULL. Phase-2 inserts children without supplying that column, so the
// insert fails with a NOT NULL constraint. Phase-1 never touches children,
// so it would succeed on its own — proving the outer transaction rolls back
// phase-1 work too.
// ---------------------------------------------------------------------------

const ATOMICITY_DDL = `
  CREATE TABLE persons (
    id TEXT PRIMARY KEY,
    sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    name_type TEXT NOT NULL DEFAULT 'birth',
    given_name TEXT NOT NULL,
    surname TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    source_factsheet_id TEXT,
    date_original TEXT,
    date_sort INTEGER,
    place_text TEXT,
    contested INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    repository_url TEXT,
    source_type TEXT NOT NULL DEFAULT 'other',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE source_citations (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    person_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL
  );
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT,
    discovery_method TEXT NOT NULL DEFAULT 'search',
    status TEXT NOT NULL DEFAULT 'collected',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    fact_date_sort INTEGER,
    factsheet_id TEXT,
    source_citation_id TEXT,
    research_item_id TEXT,
    accepted INTEGER,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    provenance TEXT NOT NULL DEFAULT 'derived',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    promoted_person_id TEXT,
    promoted_at TEXT,
    cluster_promotion_id TEXT,
    created_thread_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL,
    to_factsheet_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    source_fact_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    source_handle TEXT,
    target_handle TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE families (
    id TEXT PRIMARY KEY,
    partner1_id TEXT,
    partner2_id TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE children (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    child_order INTEGER,
    -- NO DEFAULT: phase-2 omits this column → NOT NULL violation → rollback.
    relationship_to_parent1 TEXT NOT NULL,
    relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL
  );
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    factsheet_id TEXT,
    person_id TEXT,
    research_item_id TEXT,
    research_fact_id TEXT,
    source_id TEXT,
    link_id TEXT,
    reason TEXT,
    payload_json TEXT,
    occurred_at TEXT NOT NULL
  );
`;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface ClientForRaw {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    get: (...args: unknown[]) => unknown;
  };
}

function rawClient(db: TestCentralDb): ClientForRaw {
  return db.$client as unknown as ClientForRaw;
}

function seedThreeFactsheets(db: TestCentralDb) {
  const c = rawClient(db);
  const ts = '2026-05-25T09:00:00.000Z';

  // Three factsheets with a name fact each — enough for promote to build a person.
  for (const id of ['f1', 'f2', 'f3']) {
    c.prepare(
      `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
       VALUES (?, ?, 'ready', 'u', ?, ?)`,
    ).run(id, `Sheet ${id}`, ts, ts);

    c.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, created_at, updated_at)
       VALUES (?, 'name', ?, ?, ?, ?)`,
    ).run(`rf-${id}`, `Person ${id}`, id, ts, ts);
  }

  // Links: f1 spouse f2, f1 parent_child f3 (f1=parent, f3=child).
  c.prepare(
    `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
     VALUES ('lnk-spouse', 'f1', 'f2', 'spouse', ?)`,
  ).run(ts);

  c.prepare(
    `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
     VALUES ('lnk-parent', 'f1', 'f3', 'parent_child', ?)`,
  ).run(ts);
}

// ---------------------------------------------------------------------------
// Test suite 1: cluster_promotion_id stamped uniformly (happy path)
// ---------------------------------------------------------------------------

describe('promoteFactsheetCluster stamps cluster_promotion_id (Bundle D)', () => {
  let db: TestCentralDb;

  beforeEach(() => {
    db = createTestCentralDb();
    rawClient(db)['exec'](NORMAL_DDL);
    seedThreeFactsheets(db);
  });

  it('writes the SAME cluster_promotion_id UUID across all 3 member factsheets', async () => {
    const result = await promoteFactsheetCluster(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db as any,
      'f1',
      'user-1',
    );

    expect(result.results).toHaveLength(3);

    const memberships = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getClusterMembership(db as any, 'f1'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getClusterMembership(db as any, 'f2'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getClusterMembership(db as any, 'f3'),
    ]);

    // All three should resolve to 'precise'.
    for (const m of memberships) {
      expect(m.kind).toBe('precise');
    }

    const cids = memberships.map((m) =>
      m.kind === 'precise' ? m.clusterPromotionId : null,
    );

    // All three share the same UUID.
    expect(cids[0]).toBe(cids[1]);
    expect(cids[1]).toBe(cids[2]);

    // And it conforms to UUID v4 format.
    expect(cids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('also wires families + children in the same transaction (sanity check)', async () => {
    await promoteFactsheetCluster(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db as any,
      'f1',
      'user-1',
    );

    const c = rawClient(db);
    const fams = c.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number };
    const chld = c.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number };

    // f1-spouse-f2 creates 1 family; f1-parent_child-f3 reuses that family + 1 child.
    expect(fams.n).toBeGreaterThanOrEqual(1);
    expect(chld.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Test suite 2: atomicity — phase-2 failure rolls back phase-1 work
// ---------------------------------------------------------------------------

describe('promoteFactsheetCluster atomicity (Bundle D)', () => {
  let db: TestCentralDb;

  beforeEach(() => {
    db = createTestCentralDb();
    // ATOMICITY_DDL: children.relationship_to_parent1 has NO default → NOT NULL
    // constraint fires when phase-2 tries to insert a children row.
    rawClient(db)['exec'](ATOMICITY_DDL);
    seedThreeFactsheets(db);
  });

  it('atomic: phase-2 failure rolls back phase-1 promotes', async () => {
    // The ATOMICITY_DDL intentionally breaks phase-2 child inserts (NOT NULL on
    // relationship_to_parent1 with no default). Because the f1-parent_child-f3
    // link triggers a children insert, the whole transaction must roll back.
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      promoteFactsheetCluster(db as any, 'f1', 'user-1'),
    ).rejects.toThrow();

    // None of the factsheets should have been stamped or marked promoted.
    const memberships = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getClusterMembership(db as any, 'f1'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getClusterMembership(db as any, 'f2'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getClusterMembership(db as any, 'f3'),
    ]);

    for (const m of memberships) {
      expect(m.kind).toBe('no');
    }

    // No persons, families, or children rows should have leaked through.
    const c = rawClient(db);
    const persons = c.prepare('SELECT COUNT(*) AS n FROM persons').get() as { n: number };
    const fams = c.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number };
    const chld = c.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number };

    expect(persons.n).toBe(0);
    expect(fams.n).toBe(0);
    expect(chld.n).toBe(0);
  });
});
