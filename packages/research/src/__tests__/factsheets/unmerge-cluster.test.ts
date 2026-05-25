import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import {
  unmergeFactsheetCluster,
  FactsheetNotPromotedAsClusterError,
} from '../../factsheets/unmerge-cluster';
import {
  LegacyClusterNotSupportedError,
  getClusterMembership,
} from '../../factsheets/cluster';

/**
 * Bundle D 2026-05-25 — `unmergeFactsheetCluster` reverses a cluster
 * promotion atomically.
 *
 * Bootstrap mirrors `cluster.test.ts` + `promote-cluster.test.ts`. DDL
 * includes every table that `_unmergeFactsheetInTransaction` reads or writes
 * (persons, person_names, events, sources, source_citations, research_facts,
 * factsheets) plus the cluster-edge tables (families, children) plus the
 * audit table (research_thread_events). FK constraints are ON in the
 * fixture (PRAGMA foreign_keys = ON) so dependency-order delete is
 * implicitly exercised by every successful test.
 *
 * Spec: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §3.5.
 */

// ---------------------------------------------------------------------------
// NORMAL DDL — full schema. children + families have FK references back to
// persons so dependency order is enforced by the SQLite engine.
// ---------------------------------------------------------------------------

const NORMAL_DDL = `
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
    person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
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
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
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
  CREATE TABLE families (
    id TEXT PRIMARY KEY,
    partner1_id TEXT REFERENCES persons(id),
    partner2_id TEXT REFERENCES persons(id),
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE children (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES families(id),
    person_id TEXT NOT NULL REFERENCES persons(id),
    child_order INTEGER,
    relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
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
  ['exec']: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    get: (...args: unknown[]) => unknown;
  };
}

function rawClient(db: TestCentralDb): ClientForRaw {
  return db.$client as unknown as ClientForRaw;
}

/**
 * Seed a 3-member cluster — three promoted factsheets sharing one
 * `cluster_promotion_id`, plus a families row joining the first two and a
 * children row tying the third into that family. Each member factsheet has
 * its own person + name + birth event + source + citation. Matches the
 * shape that `promoteFactsheetCluster` would have written.
 */
function seedCluster(
  db: TestCentralDb,
  clusterId: string,
  promotedAt: string,
): void {
  const c = rawClient(db);
  const members: Array<{ fs: string; person: string; given: string }> = [
    { fs: 'fs1', person: 'p1', given: 'Alice' },
    { fs: 'fs2', person: 'p2', given: 'Bob' },
    { fs: 'fs3', person: 'p3', given: 'Carol' },
  ];

  for (const m of members) {
    c.prepare(
      `INSERT INTO persons (id, created_by, created_at, updated_at)
       VALUES (?, 'u', ?, ?)`,
    ).run(m.person, promotedAt, promotedAt);

    c.prepare(
      `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at)
       VALUES (?, ?, ?, 'Doe', 1, ?)`,
    ).run(`pn-${m.person}`, m.person, m.given, promotedAt);

    c.prepare(
      `INSERT INTO events (id, person_id, event_type, date_original, created_at, updated_at)
       VALUES (?, ?, 'birth', '1820', ?, ?)`,
    ).run(`ev-${m.person}`, m.person, promotedAt, promotedAt);

    c.prepare(
      `INSERT INTO sources (id, title, created_by, created_at, updated_at)
       VALUES (?, 'Src', 'u', ?, ?)`,
    ).run(`src-${m.person}`, promotedAt, promotedAt);

    c.prepare(
      `INSERT INTO source_citations (id, source_id, person_id, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(`sc-${m.person}`, `src-${m.person}`, m.person, promotedAt);

    c.prepare(
      `INSERT INTO factsheets (id, title, status, promoted_person_id, promoted_at, cluster_promotion_id, created_by, created_at, updated_at)
       VALUES (?, ?, 'promoted', ?, ?, ?, 'u', ?, ?)`,
    ).run(m.fs, `Sheet ${m.fs}`, m.person, promotedAt, clusterId, promotedAt, promotedAt);

    c.prepare(
      `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, source_citation_id, created_at, updated_at)
       VALUES (?, 'birth_date', '1820', ?, ?, ?, ?)`,
    ).run(`rf-${m.fs}`, m.fs, `sc-${m.person}`, promotedAt, promotedAt);
  }

  // Cluster edges: p1+p2 are partners, p3 is their child.
  c.prepare(
    `INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at)
     VALUES ('fam1', 'p1', 'p2', 'marriage', 'confirmed', ?, ?)`,
  ).run(promotedAt, promotedAt);

  c.prepare(
    `INSERT INTO children (id, family_id, person_id, child_order, relationship_to_parent1, relationship_to_parent2, validation_status, created_at)
     VALUES ('ch1', 'fam1', 'p3', 1, 'biological', 'biological', 'confirmed', ?)`,
  ).run(promotedAt);
}

function seedSoloPromoted(
  db: TestCentralDb,
  fsId: string,
  personId: string,
  promotedAt: string,
): void {
  const c = rawClient(db);

  c.prepare(
    `INSERT INTO persons (id, created_by, created_at, updated_at)
     VALUES (?, 'u', ?, ?)`,
  ).run(personId, promotedAt, promotedAt);

  c.prepare(
    `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at)
     VALUES (?, ?, 'Solo', 'Doe', 1, ?)`,
  ).run(`pn-${personId}`, personId, promotedAt);

  c.prepare(
    `INSERT INTO factsheets (id, title, status, promoted_person_id, promoted_at, created_by, created_at, updated_at)
     VALUES (?, 'Solo', 'promoted', ?, ?, 'u', ?, ?)`,
  ).run(fsId, personId, promotedAt, promotedAt, promotedAt);
}

/**
 * Seed a "legacy" cluster: cluster_promotion_id is NULL but the heuristic
 * fires because a family row exists within +/-5s of promotion time.
 */
function seedLegacyCluster(
  db: TestCentralDb,
  promotedAt: string,
): void {
  const c = rawClient(db);

  // Two members, no cluster_promotion_id column populated.
  for (const [fs, person, given] of [
    ['fs1', 'p1', 'Alice'],
    ['fs2', 'p2', 'Bob'],
  ]) {
    c.prepare(
      `INSERT INTO persons (id, created_by, created_at, updated_at)
       VALUES (?, 'u', ?, ?)`,
    ).run(person, promotedAt, promotedAt);

    c.prepare(
      `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at)
       VALUES (?, ?, ?, 'Doe', 1, ?)`,
    ).run(`pn-${person}`, person, given, promotedAt);

    c.prepare(
      `INSERT INTO factsheets (id, title, status, promoted_person_id, promoted_at, cluster_promotion_id, created_by, created_at, updated_at)
       VALUES (?, ?, 'promoted', ?, ?, NULL, 'u', ?, ?)`,
    ).run(fs, `Legacy ${fs}`, person, promotedAt, promotedAt, promotedAt);
  }

  // Family row within +/-5s window — triggers legacy heuristic.
  c.prepare(
    `INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at)
     VALUES ('legfam', 'p1', 'p2', 'marriage', 'confirmed', ?, ?)`,
  ).run(promotedAt, promotedAt);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('unmergeFactsheetCluster (Bundle D)', () => {
  let db: TestCentralDb;
  const CLUSTER_ID = 'cluster-uuid-1';
  const PROMOTED_AT = '2026-05-25T10:00:00.000Z';

  beforeEach(() => {
    db = createTestCentralDb();
    rawClient(db)['exec'](NORMAL_DDL);
  });

  it('happy path: 3-member cluster reverts to ready + clears persons/families/children', async () => {
    seedCluster(db, CLUSTER_ID, PROMOTED_AT);

    const result = await unmergeFactsheetCluster(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db as any,
      {
        factsheetId: 'fs1',
        reason: 'wrong cluster',
        actorId: 'u1',
      },
    );

    expect(result.memberCount).toBe(3);
    expect(result.clusterPromotionId).toBe(CLUSTER_ID);
    expect(result.clusterUnmergeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const c = rawClient(db);

    // Every factsheet reverted to 'ready', promoted_person_id NULL, cluster_promotion_id NULL.
    const fsRows = c.prepare(
      `SELECT id, status, promoted_person_id, promoted_at, cluster_promotion_id
       FROM factsheets ORDER BY id`,
    ).all() as Array<{
      id: string;
      status: string;
      promoted_person_id: string | null;
      promoted_at: string | null;
      cluster_promotion_id: string | null;
    }>;
    expect(fsRows).toHaveLength(3);
    for (const fs of fsRows) {
      expect(fs.status).toBe('ready');
      expect(fs.promoted_person_id).toBeNull();
      expect(fs.promoted_at).toBeNull();
      expect(fs.cluster_promotion_id).toBeNull();
    }

    // All cluster-side rows are gone.
    const persons = c.prepare('SELECT COUNT(*) AS n FROM persons').get() as { n: number };
    const fams = c.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number };
    const chld = c.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number };
    const evs = c.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number };
    const cits = c.prepare('SELECT COUNT(*) AS n FROM source_citations').get() as { n: number };
    expect(persons.n).toBe(0);
    expect(fams.n).toBe(0);
    expect(chld.n).toBe(0);
    expect(evs.n).toBe(0);
    expect(cits.n).toBe(0);

    // Membership check returns 'no' after unmerge.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await getClusterMembership(db as any, 'fs1')).kind).toBe('no');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await getClusterMembership(db as any, 'fs2')).kind).toBe('no');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await getClusterMembership(db as any, 'fs3')).kind).toBe('no');
  });

  it('writes per-member factsheet_unmerged audit events that share clusterUnmergeId', async () => {
    seedCluster(db, CLUSTER_ID, PROMOTED_AT);

    const result = await unmergeFactsheetCluster(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db as any,
      {
        factsheetId: 'fs2',
        reason: 'rebuild cluster from scratch',
        actorId: 'u-actor',
        threadId: 'thread-1',
      },
    );

    const c = rawClient(db);
    const events = c.prepare(
      `SELECT event_type, actor_id, thread_id, factsheet_id, person_id, reason, payload_json
       FROM research_thread_events
       WHERE event_type = 'factsheet_unmerged'
       ORDER BY factsheet_id`,
    ).all() as Array<{
      event_type: string;
      actor_id: string;
      thread_id: string | null;
      factsheet_id: string;
      person_id: string | null;
      reason: string;
      payload_json: string | null;
    }>;

    expect(events).toHaveLength(3);

    const seenFactsheetIds = new Set<string>();
    const seenPersonIds = new Set<string>();
    for (const ev of events) {
      expect(ev.event_type).toBe('factsheet_unmerged');
      expect(ev.actor_id).toBe('u-actor');
      expect(ev.thread_id).toBe('thread-1');
      expect(ev.reason).toBe('rebuild cluster from scratch');
      expect(ev.factsheet_id).not.toBeNull();
      expect(ev.person_id).not.toBeNull();
      seenFactsheetIds.add(ev.factsheet_id);
      seenPersonIds.add(ev.person_id!);

      // Payload shape — every event shares clusterUnmergeId + clusterPromotionId
      // + clusterSize = 3.
      const payload = JSON.parse(ev.payload_json ?? '{}') as {
        clusterUnmergeId: string;
        clusterPromotionId: string;
        clusterSize: number;
      };
      expect(payload.clusterUnmergeId).toBe(result.clusterUnmergeId);
      expect(payload.clusterPromotionId).toBe(CLUSTER_ID);
      expect(payload.clusterSize).toBe(3);
    }

    // All three factsheets + all three persons covered.
    expect(seenFactsheetIds).toEqual(new Set(['fs1', 'fs2', 'fs3']));
    expect(seenPersonIds).toEqual(new Set(['p1', 'p2', 'p3']));
  });

  it('refuses solo-promoted factsheet with FactsheetNotPromotedAsClusterError', async () => {
    seedSoloPromoted(db, 'fs-solo', 'p-solo', PROMOTED_AT);

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unmergeFactsheetCluster(db as any, {
        factsheetId: 'fs-solo',
        reason: 'r',
        actorId: 'u',
      }),
    ).rejects.toBeInstanceOf(FactsheetNotPromotedAsClusterError);

    // No audit events written.
    const c = rawClient(db);
    const auditCount = c.prepare(
      `SELECT COUNT(*) AS n FROM research_thread_events`,
    ).get() as { n: number };
    expect(auditCount.n).toBe(0);

    // Solo factsheet untouched.
    const fs = c.prepare(
      `SELECT status, promoted_person_id FROM factsheets WHERE id = 'fs-solo'`,
    ).get() as { status: string; promoted_person_id: string | null };
    expect(fs.status).toBe('promoted');
    expect(fs.promoted_person_id).toBe('p-solo');
  });

  it('refuses legacy cluster with LegacyClusterNotSupportedError', async () => {
    seedLegacyCluster(db, PROMOTED_AT);

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unmergeFactsheetCluster(db as any, {
        factsheetId: 'fs1',
        reason: 'r',
        actorId: 'u',
      }),
    ).rejects.toBeInstanceOf(LegacyClusterNotSupportedError);

    // Legacy cluster untouched: persons + family still present.
    const c = rawClient(db);
    const persons = c.prepare('SELECT COUNT(*) AS n FROM persons').get() as { n: number };
    const fams = c.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number };
    expect(persons.n).toBe(2);
    expect(fams.n).toBe(1);
  });

  it('rejects missing reason with ReasonRequiredError', async () => {
    seedCluster(db, CLUSTER_ID, PROMOTED_AT);

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unmergeFactsheetCluster(db as any, {
        factsheetId: 'fs1',
        reason: '   ',
        actorId: 'u',
      }),
    ).rejects.toThrow(/reason is required/i);

    // Nothing happened.
    const c = rawClient(db);
    const fams = c.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number };
    expect(fams.n).toBe(1);
  });

  it('FK-correct dependency order: children -> families -> persons (no FK violations)', async () => {
    // The NORMAL_DDL fixture has FK constraints from children -> families,
    // children -> persons, families -> persons. The test fixture enables
    // PRAGMA foreign_keys = ON. If the algorithm ever deletes persons BEFORE
    // children/families, the engine throws FOREIGN KEY constraint failed.
    // Successful resolution here therefore proves correct dependency order.
    seedCluster(db, CLUSTER_ID, PROMOTED_AT);

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unmergeFactsheetCluster(db as any, {
        factsheetId: 'fs1',
        reason: 'r',
        actorId: 'u',
      }),
    ).resolves.toMatchObject({ memberCount: 3 });

    // Sanity: confirm FK constraints are actually enforced on this fixture.
    const c = rawClient(db);
    const pragma = c.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(pragma.foreign_keys).toBe(1);
  });

  it('atomic rollback: mid-operation FK violation leaves cluster intact', async () => {
    // Stand up a parallel DB with an extra "stray_edge" table that references
    // persons but which the unmerge algorithm does NOT clean up. The
    // persons DELETE inside `_unmergeFactsheetInTransaction` then FK-violates
    // mid-transaction, forcing a ROLLBACK. The cluster must remain intact.
    const db2 = createTestCentralDb();
    rawClient(db2)['exec'](NORMAL_DDL);
    rawClient(db2)['exec'](
      `CREATE TABLE stray_edge (
         id TEXT PRIMARY KEY,
         person_id TEXT NOT NULL REFERENCES persons(id)
       );`,
    );
    seedCluster(db2, CLUSTER_ID, PROMOTED_AT);
    rawClient(db2).prepare(
      `INSERT INTO stray_edge (id, person_id) VALUES ('s1', 'p1')`,
    ).run();

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unmergeFactsheetCluster(db2 as any, {
        factsheetId: 'fs1',
        reason: 'will fail',
        actorId: 'u',
      }),
    ).rejects.toThrow(/DELETE FROM persons|FOREIGN KEY/i);

    // Cluster intact: factsheets still promoted, persons still present,
    // families/children still present. No audit events written.
    const c = rawClient(db2);
    const fsRows = c.prepare(
      `SELECT id, status, promoted_person_id, cluster_promotion_id FROM factsheets ORDER BY id`,
    ).all() as Array<{
      id: string;
      status: string;
      promoted_person_id: string | null;
      cluster_promotion_id: string | null;
    }>;
    for (const fs of fsRows) {
      expect(fs.status).toBe('promoted');
      expect(fs.promoted_person_id).not.toBeNull();
      expect(fs.cluster_promotion_id).toBe(CLUSTER_ID);
    }

    const persons = c.prepare('SELECT COUNT(*) AS n FROM persons').get() as { n: number };
    const fams = c.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number };
    const chld = c.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number };
    expect(persons.n).toBe(3);
    expect(fams.n).toBe(1);
    expect(chld.n).toBe(1);

    const auditCount = c.prepare(
      `SELECT COUNT(*) AS n FROM research_thread_events`,
    ).get() as { n: number };
    expect(auditCount.n).toBe(0);
  });
});
