import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../family-schema';
import { rebuildClosureTable, addChildToFamily, removeChildFromFamily } from '../closure-table';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.prepare(`
    CREATE TABLE persons (id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U', is_living INTEGER NOT NULL DEFAULT 1, privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1)
  `).run();
  sqlite.prepare(`
    CREATE TABLE families (id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT, relationship_type TEXT NOT NULL DEFAULT 'unknown', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1)
  `).run();
  sqlite.prepare(`
    CREATE TABLE children (id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL, child_order INTEGER, relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological', relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological', validation_status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, UNIQUE(family_id, person_id))
  `).run();
  sqlite.prepare(`
    CREATE TABLE ancestor_paths (ancestor_id TEXT NOT NULL, descendant_id TEXT NOT NULL, depth INTEGER NOT NULL, PRIMARY KEY (ancestor_id, descendant_id))
  `).run();
  // Cast to any to allow better-sqlite3 drizzle instance to be used as FamilyDatabase
  return drizzle(sqlite, { schema }) as any;
}

const NOW = '2026-01-01T00:00:00.000Z';

function insertPerson(db: any, id: string) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES (${id}, 'U', 1, 'private', ${NOW}, ${NOW})`);
}

function insertFamily(db: any, id: string, partner1Id: string | null, partner2Id: string | null) {
  db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, relationship_type, validation_status, created_at, updated_at) VALUES (${id}, ${partner1Id}, ${partner2Id}, 'married', 'confirmed', ${NOW}, ${NOW})`);
}

function insertChild(db: any, id: string, familyId: string, personId: string) {
  db.run(sql`INSERT INTO children (id, family_id, person_id, created_at) VALUES (${id}, ${familyId}, ${personId}, ${NOW})`);
}

function getAncestorPaths(db: any) {
  return db.all(
    sql`SELECT ancestor_id, descendant_id, depth FROM ancestor_paths ORDER BY ancestor_id, descendant_id, depth`
  );
}

describe('rebuildClosureTable', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates self-references (depth=0) for all persons', async () => {
    insertPerson(db, 'p1');
    insertPerson(db, 'p2');
    insertPerson(db, 'p3');

    await rebuildClosureTable(db);

    const paths = getAncestorPaths(db);
    const selfRefs = paths.filter((p: any) => p.depth === 0);

    expect(selfRefs).toHaveLength(3);
    expect(selfRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ancestor_id: 'p1', descendant_id: 'p1', depth: 0 }),
        expect.objectContaining({ ancestor_id: 'p2', descendant_id: 'p2', depth: 0 }),
        expect.objectContaining({ ancestor_id: 'p3', descendant_id: 'p3', depth: 0 }),
      ])
    );
  });

  it('builds parent-child paths (depth=1)', async () => {
    insertPerson(db, 'dad');
    insertPerson(db, 'child');
    insertFamily(db, 'f1', 'dad', null);
    insertChild(db, 'c1', 'f1', 'child');

    await rebuildClosureTable(db);

    const paths = getAncestorPaths(db);
    const depth1 = paths.filter((p: any) => p.depth === 1);

    expect(depth1).toHaveLength(1);
    expect(depth1[0]).toEqual(
      expect.objectContaining({ ancestor_id: 'dad', descendant_id: 'child', depth: 1 })
    );
  });

  it('builds multi-generation paths (grandparent at depth=2)', async () => {
    insertPerson(db, 'grandpa');
    insertPerson(db, 'parent');
    insertPerson(db, 'kid');

    insertFamily(db, 'f1', 'grandpa', null);
    insertChild(db, 'c1', 'f1', 'parent');

    insertFamily(db, 'f2', 'parent', null);
    insertChild(db, 'c2', 'f2', 'kid');

    await rebuildClosureTable(db);

    const paths = getAncestorPaths(db);

    // grandpa -> kid at depth 2
    const gpToKid = paths.find(
      (p: any) => p.ancestor_id === 'grandpa' && p.descendant_id === 'kid'
    );
    expect(gpToKid).toBeDefined();
    expect(gpToKid!.depth).toBe(2);

    // grandpa -> parent at depth 1
    const gpToParent = paths.find(
      (p: any) => p.ancestor_id === 'grandpa' && p.descendant_id === 'parent'
    );
    expect(gpToParent).toBeDefined();
    expect(gpToParent!.depth).toBe(1);

    // parent -> kid at depth 1
    const parentToKid = paths.find(
      (p: any) => p.ancestor_id === 'parent' && p.descendant_id === 'kid'
    );
    expect(parentToKid).toBeDefined();
    expect(parentToKid!.depth).toBe(1);
  });

  it('handles two-parent families (both mom and dad get paths to child)', async () => {
    insertPerson(db, 'mom');
    insertPerson(db, 'dad');
    insertPerson(db, 'child');

    insertFamily(db, 'f1', 'dad', 'mom');
    insertChild(db, 'c1', 'f1', 'child');

    await rebuildClosureTable(db);

    const paths = getAncestorPaths(db);

    const dadToChild = paths.find(
      (p: any) => p.ancestor_id === 'dad' && p.descendant_id === 'child'
    );
    expect(dadToChild).toBeDefined();
    expect(dadToChild!.depth).toBe(1);

    const momToChild = paths.find(
      (p: any) => p.ancestor_id === 'mom' && p.descendant_id === 'child'
    );
    expect(momToChild).toBeDefined();
    expect(momToChild!.depth).toBe(1);

    // Self-references: 3 persons
    const selfRefs = paths.filter((p: any) => p.depth === 0);
    expect(selfRefs).toHaveLength(3);
  });
});

describe('addChildToFamily', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it('inserts paths for both parents incrementally', async () => {
    insertPerson(db, 'mom');
    insertPerson(db, 'dad');
    insertPerson(db, 'child');
    insertFamily(db, 'f1', 'dad', 'mom');

    // Set up self-reference rows for parents (simulating prior state)
    db.run(sql`INSERT INTO ancestor_paths VALUES ('mom', 'mom', 0)`);
    db.run(sql`INSERT INTO ancestor_paths VALUES ('dad', 'dad', 0)`);

    // Add child to family incrementally
    await addChildToFamily(db, 'f1', 'child');

    const paths = getAncestorPaths(db);

    // Child self-reference
    const childSelf = paths.find(
      (p: any) => p.ancestor_id === 'child' && p.descendant_id === 'child'
    );
    expect(childSelf).toBeDefined();
    expect(childSelf!.depth).toBe(0);

    // Dad -> child
    const dadToChild = paths.find(
      (p: any) => p.ancestor_id === 'dad' && p.descendant_id === 'child'
    );
    expect(dadToChild).toBeDefined();
    expect(dadToChild!.depth).toBe(1);

    // Mom -> child
    const momToChild = paths.find(
      (p: any) => p.ancestor_id === 'mom' && p.descendant_id === 'child'
    );
    expect(momToChild).toBeDefined();
    expect(momToChild!.depth).toBe(1);
  });
});

describe('removeChildFromFamily', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  it('removes paths when child is unlinked but keeps self-references', async () => {
    insertPerson(db, 'dad');
    insertPerson(db, 'child');
    insertFamily(db, 'f1', 'dad', null);
    insertChild(db, 'c1', 'f1', 'child');

    // Build initial closure table
    await rebuildClosureTable(db);

    // Verify paths exist before removal
    let paths = getAncestorPaths(db);
    expect(paths.find((p: any) => p.ancestor_id === 'dad' && p.descendant_id === 'child')).toBeDefined();

    // Delete the children row (simulating the unlink already happened)
    db.run(sql`DELETE FROM children WHERE id = 'c1'`);

    // Remove child from family
    await removeChildFromFamily(db, 'f1', 'child');

    paths = getAncestorPaths(db);

    // Self-references should remain
    const dadSelf = paths.find(
      (p: any) => p.ancestor_id === 'dad' && p.descendant_id === 'dad'
    );
    expect(dadSelf).toBeDefined();
    expect(dadSelf!.depth).toBe(0);

    const childSelf = paths.find(
      (p: any) => p.ancestor_id === 'child' && p.descendant_id === 'child'
    );
    expect(childSelf).toBeDefined();
    expect(childSelf!.depth).toBe(0);

    // Dad -> child path should be gone
    const dadToChild = paths.find(
      (p: any) => p.ancestor_id === 'dad' && p.descendant_id === 'child'
    );
    expect(dadToChild).toBeUndefined();
  });
});
