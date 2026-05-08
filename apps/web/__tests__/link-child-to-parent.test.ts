import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql, eq, isNull } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { linkChildToParent } from '../lib/queries';

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

afterEach(() => sqlite.close());

function makePerson(): string {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.insert(persons).values({ id, sex: 'U', isLiving: true, createdAt: now, updatedAt: now }).run();
  db.insert(personNames).values({
    id: crypto.randomUUID(), personId: id,
    givenName: 'X', surname: 'Y',
    nameType: 'birth', isPrimary: true, createdAt: now,
  }).run();
  return id;
}

describe('linkChildToParent', () => {
  it('creates a family and links the child the first time', async () => {
    const parent = makePerson();
    const child = makePerson();

    const result = await linkChildToParent(db as any, parent, child);

    expect(result.childLinked).toBe(true);
    const fams = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(fams).toHaveLength(1);
    expect(fams[0].id).toBe(result.familyId);
    expect(fams[0].partner1Id).toBe(parent);
    const kids = db.select().from(children).where(eq(children.familyId, result.familyId)).all();
    expect(kids).toHaveLength(1);
    expect(kids[0].personId).toBe(child);
  });

  it('two calls with the same parent and different children reuse one family', async () => {
    const parent = makePerson();
    const childA = makePerson();
    const childB = makePerson();

    const r1 = await linkChildToParent(db as any, parent, childA);
    const r2 = await linkChildToParent(db as any, parent, childB);

    expect(r2.familyId).toBe(r1.familyId);
    const fams = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(fams).toHaveLength(1);

    const kids = db.select().from(children).where(eq(children.familyId, r1.familyId)).all();
    expect(kids.map(k => k.personId).sort()).toEqual([childA, childB].sort());
  });

  it('is idempotent: calling twice with the same (parent, child) does not error or create duplicates', async () => {
    const parent = makePerson();
    const child = makePerson();

    const r1 = await linkChildToParent(db as any, parent, child);
    const r2 = await linkChildToParent(db as any, parent, child);

    expect(r2.familyId).toBe(r1.familyId);
    expect(r2.childLinked).toBe(false);

    const fams = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(fams).toHaveLength(1);

    const kids = db.select().from(children).where(eq(children.familyId, r1.familyId)).all();
    expect(kids).toHaveLength(1);
  });

  it('reuses an existing two-partner family rather than creating a single-parent one', async () => {
    const dad = makePerson();
    const mom = makePerson();
    const child = makePerson();
    const now = new Date().toISOString();
    const existingId = crypto.randomUUID();
    db.insert(families).values({
      id: existingId, partner1Id: dad, partner2Id: mom,
      createdAt: now, updatedAt: now,
    }).run();

    const r = await linkChildToParent(db as any, dad, child);

    expect(r.familyId).toBe(existingId);
    const fams = db.select().from(families).where(isNull(families.deletedAt)).all();
    expect(fams).toHaveLength(1);
  });
});
