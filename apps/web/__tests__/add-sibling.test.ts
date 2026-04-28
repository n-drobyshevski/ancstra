import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { addSibling, findFamiliesAsChild } from '../lib/queries';

const { persons, personNames, families, children } = schema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

  sqlite.exec(`
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
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(family_id, person_id)
    );
  `);
});

afterEach(() => {
  sqlite.close();
});

function createPerson(givenName: string, surname: string, sex: 'M' | 'F' | 'U' = 'U'): string {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.insert(persons).values({ id, sex, isLiving: true, createdAt: now, updatedAt: now }).run();
  db.insert(personNames).values({
    id: crypto.randomUUID(),
    personId: id,
    givenName,
    surname,
    nameType: 'birth',
    isPrimary: true,
    createdAt: now,
  }).run();
  return id;
}

function createFamily(partner1Id: string | null, partner2Id: string | null): string {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.insert(families).values({
    id,
    partner1Id,
    partner2Id,
    relationshipType: 'unknown',
    validationStatus: 'confirmed',
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

function addChildLink(familyId: string, personId: string): void {
  db.insert(children).values({
    id: crypto.randomUUID(),
    familyId,
    personId,
    createdAt: new Date().toISOString(),
  }).run();
}

describe('addSibling', () => {
  it('adds the sibling to an existing parent family when one exists', async () => {
    const father = createPerson('John', 'Smith', 'M');
    const mother = createPerson('Mary', 'Smith', 'F');
    const targetPerson = createPerson('Anna', 'Smith', 'F');
    const newSibling = createPerson('Bob', 'Smith', 'M');

    const parentFamilyId = createFamily(father, mother);
    addChildLink(parentFamilyId, targetPerson);

    const result = await addSibling(db as unknown as Parameters<typeof addSibling>[0], targetPerson, newSibling);

    expect(result.familyId).toBe(parentFamilyId);
    expect(result.alreadyLinked).toBe(false);

    const linksInFamily = db
      .select()
      .from(children)
      .where(eq(children.familyId, parentFamilyId))
      .all();
    expect(linksInFamily).toHaveLength(2);
    expect(linksInFamily.map((c) => c.personId).sort()).toEqual(
      [targetPerson, newSibling].sort(),
    );

    const allFamilies = db.select().from(families).all();
    expect(allFamilies).toHaveLength(1);
  });

  it('creates an unknown-parents family when target has no parents', async () => {
    const targetPerson = createPerson('Anna', 'Smith', 'F');
    const newSibling = createPerson('Bob', 'Smith', 'M');

    const result = await addSibling(db as unknown as Parameters<typeof addSibling>[0], targetPerson, newSibling);

    expect(result.alreadyLinked).toBe(false);
    expect(result.familyId).toBeTruthy();

    const [createdFamily] = db
      .select()
      .from(families)
      .where(eq(families.id, result.familyId))
      .all();
    expect(createdFamily.partner1Id).toBeNull();
    expect(createdFamily.partner2Id).toBeNull();
    expect(createdFamily.validationStatus).toBe('confirmed');

    const linksInFamily = db
      .select()
      .from(children)
      .where(eq(children.familyId, result.familyId))
      .all();
    expect(linksInFamily).toHaveLength(2);
    expect(linksInFamily.map((c) => c.personId).sort()).toEqual(
      [targetPerson, newSibling].sort(),
    );

    expect(await findFamiliesAsChild(db as unknown as Parameters<typeof findFamiliesAsChild>[0], targetPerson)).toEqual([result.familyId]);
    expect(await findFamiliesAsChild(db as unknown as Parameters<typeof findFamiliesAsChild>[0], newSibling)).toEqual([result.familyId]);
  });

  it('is idempotent — calling twice does not duplicate the child link', async () => {
    const targetPerson = createPerson('Anna', 'Smith', 'F');
    const newSibling = createPerson('Bob', 'Smith', 'M');

    const first = await addSibling(db as unknown as Parameters<typeof addSibling>[0], targetPerson, newSibling);
    const second = await addSibling(db as unknown as Parameters<typeof addSibling>[0], targetPerson, newSibling);

    expect(second.familyId).toBe(first.familyId);
    expect(second.alreadyLinked).toBe(true);

    const linksInFamily = db
      .select()
      .from(children)
      .where(eq(children.familyId, first.familyId))
      .all();
    expect(linksInFamily).toHaveLength(2);
  });

  it('uses the first parent family deterministically when target has multiple', async () => {
    const targetPerson = createPerson('Anna', 'Smith', 'F');
    const newSibling = createPerson('Bob', 'Smith', 'M');
    const stepFather = createPerson('Frank', 'Doe', 'M');

    const bioFamilyId = createFamily(createPerson('Bio', 'Father', 'M'), null);
    addChildLink(bioFamilyId, targetPerson);

    const stepFamilyId = createFamily(stepFather, null);
    addChildLink(stepFamilyId, targetPerson);

    const result = await addSibling(db as unknown as Parameters<typeof addSibling>[0], targetPerson, newSibling);

    const familyIds = await findFamiliesAsChild(db as unknown as Parameters<typeof findFamiliesAsChild>[0], targetPerson);
    expect(result.familyId).toBe(familyIds[0]);

    const siblingLinks = db
      .select()
      .from(children)
      .where(
        and(eq(children.personId, newSibling), eq(children.familyId, result.familyId)),
      )
      .all();
    expect(siblingLinks).toHaveLength(1);
  });
});
