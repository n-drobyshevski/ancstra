import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { updateFamilySchema } from '../lib/validation';

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
      prefix TEXT, given_name TEXT NOT NULL, surname TEXT NOT NULL,
      suffix TEXT, nickname TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE families (
      id TEXT PRIMARY KEY,
      partner1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      partner2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      relationship_type TEXT NOT NULL DEFAULT 'unknown',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE children (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      child_order INTEGER,
      relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
      relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(family_id, person_id)
    );
  `);
});

afterEach(() => {
  sqlite.close();
});

function createPerson(givenName: string, sex: 'M' | 'F' | 'U' = 'U'): string {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.insert(persons).values({ id, sex, isLiving: true, createdAt: now, updatedAt: now }).run();
  db.insert(personNames).values({
    id: crypto.randomUUID(),
    personId: id,
    givenName, surname: 'Test',
    nameType: 'birth', isPrimary: true,
    createdAt: now,
  }).run();
  return id;
}

describe('updateFamilySchema with nullable partners', () => {
  it('accepts partner1Id explicitly set to null', () => {
    const parsed = updateFamilySchema.safeParse({ partner1Id: null });
    expect(parsed.success).toBe(true);
  });

  it('accepts partner2Id explicitly set to null', () => {
    const parsed = updateFamilySchema.safeParse({ partner2Id: null });
    expect(parsed.success).toBe(true);
  });

  it('accepts partner ids as strings', () => {
    const parsed = updateFamilySchema.safeParse({
      partner1Id: 'some-id',
      partner2Id: 'other-id',
    });
    expect(parsed.success).toBe(true);
  });

  it('still rejects an empty body', () => {
    const parsed = updateFamilySchema.safeParse({});
    expect(parsed.success).toBe(false);
  });
});

describe('clearing a partner slot preserves family + co-partner', () => {
  it('clearing partner1 keeps partner2 and child link intact', () => {
    const father = createPerson('Father', 'M');
    const mother = createPerson('Mother', 'F');
    const child = createPerson('Child', 'U');
    const now = new Date().toISOString();
    const familyId = crypto.randomUUID();

    db.insert(families).values({
      id: familyId,
      partner1Id: father,
      partner2Id: mother,
      relationshipType: 'married',
      validationStatus: 'confirmed',
      createdAt: now, updatedAt: now,
    }).run();

    db.insert(children).values({
      id: crypto.randomUUID(),
      familyId, personId: child,
      createdAt: now,
    }).run();

    // Simulate clearing father slot
    db.update(families).set({ partner1Id: null }).where(eq(families.id, familyId)).run();

    const [fam] = db.select().from(families).where(eq(families.id, familyId)).all();
    expect(fam.partner1Id).toBeNull();
    expect(fam.partner2Id).toBe(mother);

    // Child link still intact
    const childRows = db.select().from(children).where(eq(children.familyId, familyId)).all();
    expect(childRows).toHaveLength(1);
    expect(childRows[0].personId).toBe(child);
  });
});
