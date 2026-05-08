import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, isNull, and, or } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { findOrCreateFamilyForParent } from '../lib/queries';

const { persons, personNames, families, children } = schema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

  await db.run(sql`CREATE TABLE persons (
    id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private',
    notes TEXT, created_by TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
  )`);
  await db.run(sql`CREATE TABLE person_names (
    id TEXT PRIMARY KEY, person_id TEXT NOT NULL,
    name_type TEXT NOT NULL DEFAULT 'birth',
    prefix TEXT, given_name TEXT NOT NULL, surname TEXT NOT NULL,
    suffix TEXT, nickname TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
  )`);
  await db.run(sql`CREATE TABLE families (
    id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
  )`);
  await db.run(sql`CREATE TABLE children (
    id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL,
    child_order INTEGER,
    relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
    relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    UNIQUE(family_id, person_id)
  )`);
});

afterEach(() => {
  sqlite.close();
});

function makePerson(): string {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.insert(persons).values({ id, sex: 'U', isLiving: true, createdAt: now, updatedAt: now }).run();
  db.insert(personNames).values({
    id: crypto.randomUUID(),
    personId: id,
    givenName: 'X', surname: 'Y',
    nameType: 'birth', isPrimary: true, createdAt: now,
  }).run();
  return id;
}

describe('findOrCreateFamilyForParent', () => {
  it('creates a new single-parent family when none exists for parent', async () => {
    const parent = makePerson();

    const familyId = await findOrCreateFamilyForParent(db as any, parent);

    const rows = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(familyId);
    expect(rows[0].partner1Id).toBe(parent);
    expect(rows[0].partner2Id).toBeNull();
  });

  it('reuses existing family where parent is partner1', async () => {
    const parent = makePerson();
    const now = new Date().toISOString();
    const existingId = crypto.randomUUID();
    db.insert(families).values({
      id: existingId, partner1Id: parent, partner2Id: null,
      createdAt: now, updatedAt: now,
    }).run();

    const familyId = await findOrCreateFamilyForParent(db as any, parent);

    expect(familyId).toBe(existingId);
    const rows = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(rows).toHaveLength(1);
  });

  it('reuses existing family where parent is partner2', async () => {
    const parent = makePerson();
    const spouse = makePerson();
    const now = new Date().toISOString();
    const existingId = crypto.randomUUID();
    db.insert(families).values({
      id: existingId, partner1Id: spouse, partner2Id: parent,
      createdAt: now, updatedAt: now,
    }).run();

    const familyId = await findOrCreateFamilyForParent(db as any, parent);

    expect(familyId).toBe(existingId);
    const rows = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(rows).toHaveLength(1);
  });

  it('ignores soft-deleted families and creates a new one', async () => {
    const parent = makePerson();
    const now = new Date().toISOString();
    const oldId = crypto.randomUUID();
    db.insert(families).values({
      id: oldId, partner1Id: parent, partner2Id: null,
      createdAt: now, updatedAt: now, deletedAt: now,
    }).run();

    const familyId = await findOrCreateFamilyForParent(db as any, parent);

    expect(familyId).not.toBe(oldId);
    const live = db.select().from(families)
      .where(and(isNull(families.deletedAt), or(eq(families.partner1Id, parent), eq(families.partner2Id, parent))))
      .all();
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(familyId);
  });

  it('called twice in a row returns the same family id (the bug fix)', async () => {
    const parent = makePerson();
    const childA = makePerson();
    const childB = makePerson();

    const fid1 = await findOrCreateFamilyForParent(db as any, parent);
    db.insert(children).values({
      id: crypto.randomUUID(), familyId: fid1, personId: childA,
      createdAt: new Date().toISOString(),
    }).run();

    const fid2 = await findOrCreateFamilyForParent(db as any, parent);
    db.insert(children).values({
      id: crypto.randomUUID(), familyId: fid2, personId: childB,
      createdAt: new Date().toISOString(),
    }).run();

    expect(fid2).toBe(fid1);
    const rows = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(rows).toHaveLength(1);

    const kids = db.select().from(children).where(eq(children.familyId, fid1)).all();
    expect(kids).toHaveLength(2);
  });
});
