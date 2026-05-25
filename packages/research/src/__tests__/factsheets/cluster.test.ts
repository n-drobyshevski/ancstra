import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import {
  getClusterMembership,
  getClusterMemberFactsheetIds,
  getClusterMembers,
  getClusterEdgeCount,
} from '../../factsheets/cluster';

/**
 * Bundle D 2026-05-25 — `getClusterMembership` three-state discriminated-union check.
 *
 * Covers the four interesting input shapes plus an edge case + a non-existent id:
 *   1. no                 — unpromoted factsheet
 *   2. no (solo promoted) — promoted but no cluster column, no families row
 *   3. precise            — `cluster_promotion_id` is non-null
 *   4. legacy             — `cluster_promotion_id` NULL but ±5s heuristic fires
 *   5. no (outside ±5s)   — families row is 60s after promote (NOT a legacy cluster)
 *   6. no (non-existent)  — id has no row at all
 *
 * Bootstrap mirrors the canonical pattern from `unmerge.test.ts`.
 * NOTE: `factsheets` includes the new `cluster_promotion_id` column from
 * Bundle D Task 1.
 */

const DDL = `
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
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL
  );
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    given_name TEXT,
    surname TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;

interface PreparedClient {
  prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
}

function client(): PreparedClient {
  return db.$client as unknown as PreparedClient;
}

function insertPerson(id: string, ts = '2026-05-25T10:00:00.000Z') {
  client()
    .prepare(
      `INSERT INTO persons (id, created_by, created_at, updated_at) VALUES (?, 'u', ?, ?)`,
    )
    .run(id, ts, ts);
}

function insertFactsheet(opts: {
  id: string;
  title?: string;
  promotedPersonId?: string | null;
  promotedAt?: string | null;
  clusterPromotionId?: string | null;
  createdAt?: string;
}) {
  client()
    .prepare(
      `INSERT INTO factsheets
        (id, title, status, promoted_person_id, promoted_at, cluster_promotion_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'u', ?, ?)`,
    )
    .run(
      opts.id,
      opts.title ?? `Title for ${opts.id}`,
      opts.promotedPersonId ? 'promoted' : 'draft',
      opts.promotedPersonId ?? null,
      opts.promotedAt ?? null,
      opts.clusterPromotionId ?? null,
      opts.createdAt ?? '2026-05-25T09:00:00.000Z',
      opts.createdAt ?? '2026-05-25T09:00:00.000Z',
    );
}

function insertFamily(opts: {
  id: string;
  partner1Id?: string | null;
  partner2Id?: string | null;
  createdAt: string;
}) {
  client()
    .prepare(
      `INSERT INTO families
        (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at)
       VALUES (?, ?, ?, 'unknown', 'confirmed', ?, ?)`,
    )
    .run(opts.id, opts.partner1Id ?? null, opts.partner2Id ?? null, opts.createdAt, opts.createdAt);
}

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('getClusterMembership (Bundle D)', () => {
  it('returns kind=no for an unpromoted factsheet', async () => {
    insertFactsheet({ id: 'fs-solo' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TestCentralDb satisfies Database at runtime
    const result = await getClusterMembership(db as any, 'fs-solo');
    expect(result.kind).toBe('no');
  });

  it('returns kind=no for a solo-promoted factsheet (column null, no heuristic match)', async () => {
    insertPerson('p1');
    insertFactsheet({
      id: 'fs-solo-promoted',
      promotedPersonId: 'p1',
      promotedAt: '2026-05-25T10:00:00.000Z',
      clusterPromotionId: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getClusterMembership(db as any, 'fs-solo-promoted');
    expect(result.kind).toBe('no');
  });

  it('returns kind=precise with clusterPromotionId for a Bundle-D cluster member', async () => {
    insertPerson('p2');
    const cid = '11111111-1111-1111-1111-111111111111';
    insertFactsheet({
      id: 'fs-precise',
      promotedPersonId: 'p2',
      promotedAt: '2026-05-25T10:00:00.000Z',
      clusterPromotionId: cid,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getClusterMembership(db as any, 'fs-precise');
    expect(result.kind).toBe('precise');
    if (result.kind === 'precise') {
      expect(result.clusterPromotionId).toBe(cid);
    }
  });

  it('returns kind=legacy for a pre-Bundle-D cluster (column null, families row within ±5s)', async () => {
    insertPerson('p3');
    insertPerson('p4');
    insertFactsheet({
      id: 'fs-legacy',
      promotedPersonId: 'p3',
      promotedAt: '2026-05-25T10:00:00.000Z',
      clusterPromotionId: null,
    });
    // families.created_at within +2s of promoted_at — legacy heuristic fires.
    insertFamily({
      id: 'fam1',
      partner1Id: 'p3',
      partner2Id: 'p4',
      createdAt: '2026-05-25T10:00:02.000Z',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getClusterMembership(db as any, 'fs-legacy');
    expect(result.kind).toBe('legacy');
  });

  it('returns kind=no when the families row is OUTSIDE ±5s (not a legacy cluster)', async () => {
    insertPerson('p5');
    insertPerson('p6');
    insertFactsheet({
      id: 'fs-not-legacy',
      promotedPersonId: 'p5',
      promotedAt: '2026-05-25T10:00:00.000Z',
      clusterPromotionId: null,
    });
    // 60s after promoted_at — outside the ±5s window.
    insertFamily({
      id: 'fam2',
      partner1Id: 'p5',
      partner2Id: 'p6',
      createdAt: '2026-05-25T10:01:00.000Z',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getClusterMembership(db as any, 'fs-not-legacy');
    expect(result.kind).toBe('no');
  });

  it('returns kind=no for a non-existent factsheet', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getClusterMembership(db as any, 'no-such-id');
    expect(result.kind).toBe('no');
  });
});

// ---------------------------------------------------------------------------
// Helpers for lower-level function tests
// ---------------------------------------------------------------------------

function insertPersonName(opts: {
  id: string;
  personId: string;
  givenName?: string | null;
  surname?: string | null;
  isPrimary?: boolean;
}) {
  client()
    .prepare(
      `INSERT INTO person_names (id, person_id, given_name, surname, is_primary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '2026-05-25T09:00:00.000Z', '2026-05-25T09:00:00.000Z')`,
    )
    .run(
      opts.id,
      opts.personId,
      opts.givenName ?? null,
      opts.surname ?? null,
      opts.isPrimary ? 1 : 0,
    );
}

function insertChild(opts: {
  id: string;
  familyId: string;
  personId: string;
  createdAt?: string;
}) {
  client()
    .prepare(
      `INSERT INTO children (id, family_id, person_id, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(opts.id, opts.familyId, opts.personId, opts.createdAt ?? '2026-05-25T09:00:00.000Z');
}

// ---------------------------------------------------------------------------

describe('getClusterMemberFactsheetIds (Bundle D)', () => {
  it('returns the IDs of all factsheets sharing a cluster_promotion_id', async () => {
    const cid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    insertPerson('pm1');
    insertPerson('pm2');
    insertPerson('pm3');
    insertFactsheet({ id: 'fscm1', promotedPersonId: 'pm1', clusterPromotionId: cid });
    insertFactsheet({ id: 'fscm2', promotedPersonId: 'pm2', clusterPromotionId: cid });
    insertFactsheet({ id: 'fscm3', promotedPersonId: 'pm3', clusterPromotionId: cid });
    // Unrelated factsheet — different cluster id, must NOT appear.
    insertFactsheet({
      id: 'fscm-other',
      clusterPromotionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = await getClusterMemberFactsheetIds(db as any, cid);

    expect(ids).toHaveLength(3);
    expect(ids).toEqual(expect.arrayContaining(['fscm1', 'fscm2', 'fscm3']));
  });

  it('returns an empty array when no factsheets match the cluster_promotion_id', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = await getClusterMemberFactsheetIds(db as any, 'no-such-cluster');
    expect(ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('getClusterMembers (Bundle D)', () => {
  it('returns display data joined from persons and person_names for each member', async () => {
    const cid = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    insertPerson('pgm1');
    insertPerson('pgm2');
    insertFactsheet({
      id: 'fsgm1',
      title: 'Sheet One',
      promotedPersonId: 'pgm1',
      clusterPromotionId: cid,
      createdAt: '2026-05-25T09:00:00.000Z',
    });
    insertFactsheet({
      id: 'fsgm2',
      title: 'Sheet Two',
      promotedPersonId: 'pgm2',
      clusterPromotionId: cid,
      createdAt: '2026-05-25T09:01:00.000Z',
    });
    insertPersonName({ id: 'pn1', personId: 'pgm1', givenName: 'Alice', surname: 'Smith', isPrimary: true });
    insertPersonName({ id: 'pn2', personId: 'pgm2', givenName: 'Bob', surname: 'Jones', isPrimary: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members = await getClusterMembers(db as any, cid);

    expect(members).toHaveLength(2);
    // Ordered by created_at ASC so fsgm1 is first.
    expect(members[0]).toMatchObject({
      factsheetId: 'fsgm1',
      factsheetTitle: 'Sheet One',
      personId: 'pgm1',
      personGivenName: 'Alice',
      personSurname: 'Smith',
    });
    expect(members[1]).toMatchObject({
      factsheetId: 'fsgm2',
      factsheetTitle: 'Sheet Two',
      personId: 'pgm2',
      personGivenName: 'Bob',
      personSurname: 'Jones',
    });
  });

  it('excludes factsheets where promoted_person_id IS NULL (IS NOT NULL filter)', async () => {
    const cid = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

    insertPerson('pgm3');
    // Member with a valid person — should be included.
    insertFactsheet({
      id: 'fsgm-valid',
      title: 'Valid Member',
      promotedPersonId: 'pgm3',
      clusterPromotionId: cid,
    });
    // Member with cluster_promotion_id set but promoted_person_id NULL — must be excluded.
    insertFactsheet({
      id: 'fsgm-null-person',
      title: 'Null Person Member',
      promotedPersonId: null,
      clusterPromotionId: cid,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members = await getClusterMembers(db as any, cid);

    expect(members).toHaveLength(1);
    expect(members[0].factsheetId).toBe('fsgm-valid');
  });
});

// ---------------------------------------------------------------------------

describe('getClusterEdgeCount (Bundle D)', () => {
  it('counts families and children rows linked to cluster persons', async () => {
    const cid = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    insertPerson('pec1');
    insertPerson('pec2');
    insertPerson('pec3'); // child person
    insertFactsheet({ id: 'fsec1', promotedPersonId: 'pec1', clusterPromotionId: cid });
    insertFactsheet({ id: 'fsec2', promotedPersonId: 'pec2', clusterPromotionId: cid });

    // 2 family rows — one linking pec1 as partner1, one linking pec2 as partner2.
    insertFamily({ id: 'fam-ec1', partner1Id: 'pec1', partner2Id: null, createdAt: '2026-05-25T09:00:00.000Z' });
    insertFamily({ id: 'fam-ec2', partner1Id: null, partner2Id: 'pec2', createdAt: '2026-05-25T09:00:00.000Z' });
    // Unrelated family — must NOT be counted.
    insertFamily({ id: 'fam-ec3', partner1Id: 'pec3', partner2Id: null, createdAt: '2026-05-25T09:00:00.000Z' });

    // children rows where person_id is a cluster member (pec1 or pec2).
    // These represent pec1 and pec2 appearing as children in some families.
    insertChild({ id: 'ch1', familyId: 'fam-ec3', personId: 'pec1' }); // pec1 is a cluster member → counted
    insertChild({ id: 'ch2', familyId: 'fam-ec3', personId: 'pec2' }); // pec2 is a cluster member → counted
    insertChild({ id: 'ch3', familyId: 'fam-ec3', personId: 'pec1' }); // another row for pec1 → counted
    // Row where person_id is NOT a cluster member — must NOT be counted.
    insertChild({ id: 'ch4', familyId: 'fam-ec1', personId: 'pec3' }); // pec3 not in cluster

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await getClusterEdgeCount(db as any, cid);

    expect(count.families).toBe(2);
    expect(count.children).toBe(3);
  });

  it('returns zeros when no families or children rows exist for the cluster', async () => {
    const cid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

    insertPerson('pec-empty');
    insertFactsheet({ id: 'fsec-empty', promotedPersonId: 'pec-empty', clusterPromotionId: cid });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await getClusterEdgeCount(db as any, cid);

    expect(count.families).toBe(0);
    expect(count.children).toBe(0);
  });

  it('returns zeros when the cluster has no promoted persons (all NULL)', async () => {
    const cid = '00000000-0000-0000-0000-000000000000';

    // Factsheet with cluster_promotion_id but no promoted_person_id.
    insertFactsheet({ id: 'fsec-noperson', promotedPersonId: null, clusterPromotionId: cid });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await getClusterEdgeCount(db as any, cid);

    expect(count.families).toBe(0);
    expect(count.children).toBe(0);
  });
});
