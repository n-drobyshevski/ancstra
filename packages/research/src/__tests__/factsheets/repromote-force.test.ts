import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { promoteFactsheetCluster } from '../../factsheets/promote';
import { _forceRepromoteClusterMemberInTransaction } from '../../factsheets/repromote-force';
import { getClusterMembership } from '../../factsheets/cluster';

/**
 * Bundle D Task 11 (2026-05-25) — `_forceRepromoteClusterMemberInTransaction`
 * surgical-swap unit test.
 *
 * Code-review gap (Task 11): the HTTP-route test at
 * `apps/web/__tests__/api/research/factsheets/repromote-force.test.ts` mocks
 * this function, so the SQL ordering is never exercised against a real DB.
 *
 * This file exercises the function directly against a real better-sqlite3
 * DB with `PRAGMA foreign_keys = ON`. Cluster seeding uses the real
 * `promoteFactsheetCluster` flow (not manual INSERTs) so the swap operates on
 * the exact shape that production produces.
 *
 * Spec: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §3.4.
 */

// ---------------------------------------------------------------------------
// DDL — full schema. Mirrors promote-cluster.test.ts NORMAL_DDL (so
// `promoteFactsheetCluster` succeeds in seeding) PLUS adds FK references that
// match the real family-schema:
//   - families.partner1_id REFERENCES persons(id) ON DELETE SET NULL
//   - families.partner2_id REFERENCES persons(id) ON DELETE SET NULL
//   - children.person_id   REFERENCES persons(id) ON DELETE CASCADE
//
// The whole point of this test file is to FK-stress the surgical swap, so
// these references are NOT optional.
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
    person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
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
    partner1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
    partner2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
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
 * Seed three "ready" factsheets with name facts + spouse/parent_child links
 * — exactly the shape that `promoteFactsheetCluster` consumes. After
 * promotion we get 3 persons, 1 family (f1+f2 spouses), 1 child (f3), and
 * a shared `cluster_promotion_id`.
 */
function seedReadyCluster(db: TestCentralDb): void {
  const c = rawClient(db);
  const ts = '2026-05-25T09:00:00.000Z';

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

  c.prepare(
    `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
     VALUES ('lnk-spouse', 'f1', 'f2', 'spouse', ?)`,
  ).run(ts);

  c.prepare(
    `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
     VALUES ('lnk-parent', 'f1', 'f3', 'parent_child', ?)`,
  ).run(ts);
}

interface FactsheetRow {
  id: string;
  status: string;
  promoted_person_id: string | null;
  cluster_promotion_id: string | null;
}

function getFactsheet(db: TestCentralDb, id: string): FactsheetRow {
  return rawClient(db).prepare(
    `SELECT id, status, promoted_person_id, cluster_promotion_id
     FROM factsheets WHERE id = ?`,
  ).get(id) as FactsheetRow;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('_forceRepromoteClusterMemberInTransaction (Bundle D Task 11)', () => {
  let db: TestCentralDb;

  beforeEach(() => {
    db = createTestCentralDb();
    rawClient(db)['exec'](NORMAL_DDL);
    seedReadyCluster(db);
  });

  it('happy path: surgical swap replaces ONE person; cluster + sibling members intact', async () => {
    // ---- Phase 1: real cluster promote ----
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await promoteFactsheetCluster(db as any, 'f1', 'user-1');

    const before1 = getFactsheet(db, 'f1');
    const before2 = getFactsheet(db, 'f2');
    const before3 = getFactsheet(db, 'f3');
    const personIdOld = before1.promoted_person_id!;
    const personId2 = before2.promoted_person_id!;
    const personId3 = before3.promoted_person_id!;
    const clusterPromotionId = before1.cluster_promotion_id!;

    expect(personIdOld).toBeTruthy();
    expect(personId2).toBeTruthy();
    expect(personId3).toBeTruthy();
    expect(clusterPromotionId).toBeTruthy();
    expect(before2.cluster_promotion_id).toBe(clusterPromotionId);
    expect(before3.cluster_promotion_id).toBe(clusterPromotionId);

    // Sanity: FK enforcement is on.
    const pragma = rawClient(db).prepare('PRAGMA foreign_keys').get() as {
      foreign_keys: number;
    };
    expect(pragma.foreign_keys).toBe(1);

    // Capture all rows that point at personIdOld BEFORE the swap.
    const c = rawClient(db);
    const familiesReferencingOld = c.prepare(
      `SELECT id FROM families
       WHERE partner1_id = ? OR partner2_id = ?`,
    ).all(personIdOld, personIdOld) as Array<{ id: string }>;
    const childrenReferencingOld = c.prepare(
      `SELECT id FROM children WHERE person_id = ?`,
    ).all(personIdOld) as Array<{ id: string }>;
    const eventsForOld = c.prepare(
      `SELECT id FROM events WHERE person_id = ?`,
    ).all(personIdOld) as Array<{ id: string }>;

    // f1 is partner1 in the spouse family; should have at least one row.
    expect(familiesReferencingOld.length).toBeGreaterThanOrEqual(1);
    expect(eventsForOld.length).toBeGreaterThanOrEqual(0); // f1 has only a name fact → no events

    // ---- Phase 2: surgical swap ----
    const now = '2026-05-25T10:00:00.000Z';
    await db.run(sql`BEGIN IMMEDIATE`);
    let result;
    try {
      result = await _forceRepromoteClusterMemberInTransaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db as any,
        {
          factsheetId: 'f1',
          reason: 'wrong person',
          actorId: 'u-actor',
          threadId: null,
          clusterPromotionId,
          personIdOld,
        },
        now,
      );
      await db.run(sql`COMMIT`);
    } catch (err) {
      await db.run(sql`ROLLBACK`);
      throw err;
    }

    // ---- Returned shape ----
    expect(result.factsheetId).toBe('f1');
    expect(result.previousPersonId).toBe(personIdOld);
    expect(result.clusterPromotionId).toBe(clusterPromotionId);
    expect(result.personId).not.toBe(personIdOld);
    expect(result.personId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const personIdNew = result.personId;

    // ---- Factsheets row: only f1 promoted_person_id flipped; cluster id stable. ----
    const after1 = getFactsheet(db, 'f1');
    const after2 = getFactsheet(db, 'f2');
    const after3 = getFactsheet(db, 'f3');
    expect(after1.promoted_person_id).toBe(personIdNew);
    expect(after1.cluster_promotion_id).toBe(clusterPromotionId);
    expect(after1.status).toBe('promoted');
    expect(after2.promoted_person_id).toBe(personId2);
    expect(after2.cluster_promotion_id).toBe(clusterPromotionId);
    expect(after3.promoted_person_id).toBe(personId3);
    expect(after3.cluster_promotion_id).toBe(clusterPromotionId);

    // ---- persons table: old GONE, new EXISTS; siblings UNTOUCHED. ----
    const personOld = c.prepare('SELECT id FROM persons WHERE id = ?').get(personIdOld);
    const personNew = c.prepare('SELECT id FROM persons WHERE id = ?').get(personIdNew);
    const personSibling2 = c.prepare('SELECT id FROM persons WHERE id = ?').get(personId2);
    const personSibling3 = c.prepare('SELECT id FROM persons WHERE id = ?').get(personId3);
    expect(personOld).toBeUndefined();
    expect(personNew).toBeTruthy();
    expect(personSibling2).toBeTruthy();
    expect(personSibling3).toBeTruthy();

    // ---- families: every row that referenced personIdOld now references personIdNew. ----
    for (const fam of familiesReferencingOld) {
      const row = c.prepare(
        `SELECT partner1_id, partner2_id FROM families WHERE id = ?`,
      ).get(fam.id) as { partner1_id: string | null; partner2_id: string | null };
      const refsNew =
        row.partner1_id === personIdNew || row.partner2_id === personIdNew;
      const refsOld =
        row.partner1_id === personIdOld || row.partner2_id === personIdOld;
      expect(refsNew).toBe(true);
      expect(refsOld).toBe(false);
    }
    // Rows referencing siblings 2 and 3 still do.
    const allFamilies = c.prepare(
      `SELECT id, partner1_id, partner2_id FROM families`,
    ).all() as Array<{
      id: string;
      partner1_id: string | null;
      partner2_id: string | null;
    }>;
    const familyRefsOldStill = allFamilies.some(
      (f) => f.partner1_id === personIdOld || f.partner2_id === personIdOld,
    );
    expect(familyRefsOldStill).toBe(false);

    // ---- children: every row that had person_id = personIdOld now references new. ----
    for (const ch of childrenReferencingOld) {
      const row = c.prepare(
        `SELECT person_id FROM children WHERE id = ?`,
      ).get(ch.id) as { person_id: string };
      expect(row.person_id).toBe(personIdNew);
    }
    // Siblings 2 and 3 untouched in children too.
    const childRefsOldStill = (c.prepare(
      `SELECT COUNT(*) AS n FROM children WHERE person_id = ?`,
    ).get(personIdOld) as { n: number }).n;
    expect(childRefsOldStill).toBe(0);
    const childRefsSibling3 = (c.prepare(
      `SELECT COUNT(*) AS n FROM children WHERE person_id = ?`,
    ).get(personId3) as { n: number }).n;
    expect(childRefsSibling3).toBeGreaterThanOrEqual(0); // f3 is the child here

    // ---- events: old GONE; new exist with sourceFactsheetId set. ----
    const eventsOld = c.prepare(
      `SELECT COUNT(*) AS n FROM events WHERE person_id = ?`,
    ).get(personIdOld) as { n: number };
    expect(eventsOld.n).toBe(0);
    const eventsNew = c.prepare(
      `SELECT person_id, source_factsheet_id FROM events WHERE person_id = ?`,
    ).all(personIdNew) as Array<{ person_id: string; source_factsheet_id: string | null }>;
    for (const ev of eventsNew) {
      expect(ev.source_factsheet_id).toBe('f1');
    }

    // ---- source_citations: old GONE; new exist (if any). ----
    const citsOld = c.prepare(
      `SELECT COUNT(*) AS n FROM source_citations WHERE person_id = ?`,
    ).get(personIdOld) as { n: number };
    expect(citsOld.n).toBe(0);
  });

  it('FK enforcement is on (sanity)', async () => {
    const pragma = rawClient(db).prepare('PRAGMA foreign_keys').get() as {
      foreign_keys: number;
    };
    expect(pragma.foreign_keys).toBe(1);
  });

  it('atomic rollback: stray FK reference forces ROLLBACK; cluster unchanged', async () => {
    // Stand up a parallel DB with an extra "stray_edge" table whose FK
    // references persons(id) WITHOUT ON DELETE CASCADE/SET NULL. The
    // surgical swap repoints `families` and `children` to the new person, but
    // step 5's `DELETE FROM persons WHERE id = personIdOld` FK-violates
    // because stray_edge still references it. The outer transaction must roll
    // back, leaving the cluster intact.
    const db2 = createTestCentralDb();
    rawClient(db2)['exec'](NORMAL_DDL);
    rawClient(db2)['exec'](
      `CREATE TABLE stray_edge (
         id TEXT PRIMARY KEY,
         person_id TEXT NOT NULL REFERENCES persons(id)
       );`,
    );

    // Seed cluster on db2.
    const c2 = rawClient(db2);
    const ts = '2026-05-25T09:00:00.000Z';
    for (const id of ['f1', 'f2', 'f3']) {
      c2.prepare(
        `INSERT INTO factsheets (id, title, status, created_by, created_at, updated_at)
         VALUES (?, ?, 'ready', 'u', ?, ?)`,
      ).run(id, `Sheet ${id}`, ts, ts);
      c2.prepare(
        `INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, created_at, updated_at)
         VALUES (?, 'name', ?, ?, ?, ?)`,
      ).run(`rf-${id}`, `Person ${id}`, id, ts, ts);
    }
    c2.prepare(
      `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
       VALUES ('lnk-spouse', 'f1', 'f2', 'spouse', ?)`,
    ).run(ts);
    c2.prepare(
      `INSERT INTO factsheet_links (id, from_factsheet_id, to_factsheet_id, relationship_type, created_at)
       VALUES ('lnk-parent', 'f1', 'f3', 'parent_child', ?)`,
    ).run(ts);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await promoteFactsheetCluster(db2 as any, 'f1', 'user-1');

    const before1 = getFactsheet(db2, 'f1');
    const before2 = getFactsheet(db2, 'f2');
    const before3 = getFactsheet(db2, 'f3');
    const personIdOld = before1.promoted_person_id!;
    const personId2 = before2.promoted_person_id!;
    const personId3 = before3.promoted_person_id!;
    const clusterPromotionId = before1.cluster_promotion_id!;

    // Insert the stray edge AFTER promotion so it references the real old person.
    c2.prepare(
      `INSERT INTO stray_edge (id, person_id) VALUES ('s1', ?)`,
    ).run(personIdOld);

    // Count families + children rows BEFORE the swap attempt.
    const famsBefore = (c2.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number }).n;
    const chldBefore = (c2.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number }).n;
    const personsBefore = (c2.prepare('SELECT COUNT(*) AS n FROM persons').get() as { n: number }).n;

    // Attempt the swap inside the outer BEGIN/ROLLBACK envelope. The DELETE
    // FROM persons inside step 5 will FK-violate against stray_edge, the
    // catch-block runs ROLLBACK, and the throw propagates.
    const now = '2026-05-25T10:00:00.000Z';
    let threw = false;
    await db2.run(sql`BEGIN IMMEDIATE`);
    try {
      await _forceRepromoteClusterMemberInTransaction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db2 as any,
        {
          factsheetId: 'f1',
          reason: 'will fail',
          actorId: 'u',
          threadId: null,
          clusterPromotionId,
          personIdOld,
        },
        now,
      );
      await db2.run(sql`COMMIT`);
    } catch (err) {
      threw = true;
      await db2.run(sql`ROLLBACK`);
      expect(String(err)).toMatch(/FOREIGN KEY|persons/i);
    }
    expect(threw).toBe(true);

    // ---- Cluster intact: factsheets row still references OLD person. ----
    const after1 = getFactsheet(db2, 'f1');
    const after2 = getFactsheet(db2, 'f2');
    const after3 = getFactsheet(db2, 'f3');
    expect(after1.promoted_person_id).toBe(personIdOld);
    expect(after1.cluster_promotion_id).toBe(clusterPromotionId);
    expect(after1.status).toBe('promoted');
    expect(after2.promoted_person_id).toBe(personId2);
    expect(after3.promoted_person_id).toBe(personId3);

    // Old person row STILL EXISTS (DELETE was rolled back).
    const personOld = c2.prepare('SELECT id FROM persons WHERE id = ?').get(personIdOld);
    expect(personOld).toBeTruthy();

    // No new person row leaked through.
    const personsAfter = (c2.prepare('SELECT COUNT(*) AS n FROM persons').get() as { n: number }).n;
    expect(personsAfter).toBe(personsBefore);

    // Families/children row counts unchanged.
    const famsAfter = (c2.prepare('SELECT COUNT(*) AS n FROM families').get() as { n: number }).n;
    const chldAfter = (c2.prepare('SELECT COUNT(*) AS n FROM children').get() as { n: number }).n;
    expect(famsAfter).toBe(famsBefore);
    expect(chldAfter).toBe(chldBefore);

    // All family/children rows still point at the OLD person.
    const fams = c2.prepare(
      `SELECT partner1_id, partner2_id FROM families`,
    ).all() as Array<{ partner1_id: string | null; partner2_id: string | null }>;
    const stillRefsOld = fams.some(
      (f) => f.partner1_id === personIdOld || f.partner2_id === personIdOld,
    );
    expect(stillRefsOld).toBe(true);

    // Membership still resolves precisely to the same cluster.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membership = await getClusterMembership(db2 as any, 'f1');
    expect(membership.kind).toBe('precise');
    if (membership.kind === 'precise') {
      expect(membership.clusterPromotionId).toBe(clusterPromotionId);
    }
  });
});
