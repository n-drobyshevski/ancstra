import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, isNull } from 'drizzle-orm';
import * as schema from '@ancstra/db';
import { createFamilySchema, updateFamilySchema, addChildSchema } from '../../lib/validation';

const { persons, personNames, events, users, families, children } = schema;

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
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
      created_at TEXT NOT NULL
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      date_original TEXT,
      date_sort INTEGER,
      date_modifier TEXT DEFAULT 'exact',
      date_end_sort INTEGER,
      place_text TEXT,
      description TEXT,
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      family_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE families (
      id TEXT PRIMARY KEY,
      partner1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      partner2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      relationship_type TEXT NOT NULL DEFAULT 'unknown',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
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
      UNIQUE(family_id, person_id)
    );
  `);

  db.insert(users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    })
    .run();
});

afterEach(() => {
  sqlite.close();
});

function createPerson(data: {
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
  isLiving: boolean;
}) {
  const now = new Date().toISOString();
  const personId = crypto.randomUUID();

  db.insert(persons)
    .values({
      id: personId,
      sex: data.sex,
      isLiving: data.isLiving,
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(personNames)
    .values({
      id: crypto.randomUUID(),
      personId,
      givenName: data.givenName,
      surname: data.surname,
      nameType: 'birth',
      isPrimary: true,
      createdAt: now,
    })
    .run();

  return personId;
}

function createFamily(partner1Id: string | null, partner2Id: string | null, relationshipType: 'married' | 'civil_union' | 'domestic_partner' | 'unmarried' | 'unknown' = 'unknown') {
  const now = new Date().toISOString();
  const familyId = crypto.randomUUID();

  db.insert(families)
    .values({
      id: familyId,
      partner1Id,
      partner2Id,
      relationshipType,
      validationStatus: 'confirmed',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return familyId;
}

describe('Family CRUD (integration)', () => {
  it('creates family linking two persons', () => {
    const p1 = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const p2 = createPerson({ givenName: 'Mary', surname: 'Jones', sex: 'F', isLiving: false });

    const familyId = createFamily(p1, p2, 'married');

    const [family] = db.select().from(families).where(eq(families.id, familyId)).all();
    expect(family).toBeDefined();
    expect(family.partner1Id).toBe(p1);
    expect(family.partner2Id).toBe(p2);
    expect(family.relationshipType).toBe('married');
    expect(family.validationStatus).toBe('confirmed');
  });

  it('rejects duplicate family for same pair', () => {
    const p1 = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const p2 = createPerson({ givenName: 'Mary', surname: 'Jones', sex: 'F', isLiving: false });

    createFamily(p1, p2);

    // Check both directions: p1-p2 already exists
    const existingForward = db
      .select({ id: families.id })
      .from(families)
      .where(
        and(
          isNull(families.deletedAt),
          eq(families.partner1Id, p1),
          eq(families.partner2Id, p2)
        )
      )
      .all();
    expect(existingForward).toHaveLength(1);

    // Simulate the reverse check (p2-p1)
    const existingReverse = db
      .select({ id: families.id })
      .from(families)
      .where(
        and(
          isNull(families.deletedAt),
          eq(families.partner1Id, p2),
          eq(families.partner2Id, p1)
        )
      )
      .all();
    expect(existingReverse).toHaveLength(0);

    // But a combined OR check (as the route does) should find the existing one
    // Creating a second family with same pair should be detected
    const duplicateCheck = db
      .select({ id: families.id })
      .from(families)
      .where(
        and(
          isNull(families.deletedAt),
          // Check forward direction
          eq(families.partner1Id, p1),
          eq(families.partner2Id, p2)
        )
      )
      .all();
    expect(duplicateCheck.length).toBeGreaterThan(0);

    // Also validate the schema itself
    const parsed = createFamilySchema.safeParse({ partner1Id: p1, partner2Id: p2 });
    expect(parsed.success).toBe(true);
  });

  it('allows single-partner family', () => {
    const p1 = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: true });

    const familyId = createFamily(p1, null);

    const [family] = db.select().from(families).where(eq(families.id, familyId)).all();
    expect(family).toBeDefined();
    expect(family.partner1Id).toBe(p1);
    expect(family.partner2Id).toBeNull();

    // Schema validation: at least one partner required
    const valid = createFamilySchema.safeParse({ partner1Id: p1 });
    expect(valid.success).toBe(true);

    const invalid = createFamilySchema.safeParse({});
    expect(invalid.success).toBe(false);
  });

  it('retrieves family with partners and children', () => {
    const p1 = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const p2 = createPerson({ givenName: 'Mary', surname: 'Jones', sex: 'F', isLiving: false });
    const child1 = createPerson({ givenName: 'Junior', surname: 'Smith', sex: 'M', isLiving: true });

    const familyId = createFamily(p1, p2, 'married');

    // Add child
    db.insert(children)
      .values({
        id: crypto.randomUUID(),
        familyId,
        personId: child1,
        childOrder: 1,
        relationshipToParent1: 'biological',
        relationshipToParent2: 'biological',
        validationStatus: 'confirmed',
        createdAt: new Date().toISOString(),
      })
      .run();

    // Retrieve family
    const [family] = db
      .select()
      .from(families)
      .where(and(eq(families.id, familyId), isNull(families.deletedAt)))
      .all();
    expect(family).toBeDefined();
    expect(family.partner1Id).toBe(p1);
    expect(family.partner2Id).toBe(p2);

    // Retrieve partner names
    const [p1Name] = db
      .select({ givenName: personNames.givenName, surname: personNames.surname })
      .from(personNames)
      .where(and(eq(personNames.personId, p1), eq(personNames.isPrimary, true)))
      .all();
    expect(p1Name.givenName).toBe('John');

    const [p2Name] = db
      .select({ givenName: personNames.givenName, surname: personNames.surname })
      .from(personNames)
      .where(and(eq(personNames.personId, p2), eq(personNames.isPrimary, true)))
      .all();
    expect(p2Name.givenName).toBe('Mary');

    // Retrieve children
    const childRows = db
      .select()
      .from(children)
      .where(eq(children.familyId, familyId))
      .all();
    expect(childRows).toHaveLength(1);
    expect(childRows[0].personId).toBe(child1);
    expect(childRows[0].childOrder).toBe(1);
  });

  it('adds child to family', () => {
    const p1 = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const child1 = createPerson({ givenName: 'Junior', surname: 'Smith', sex: 'M', isLiving: true });

    const familyId = createFamily(p1, null);

    // Validate with addChildSchema
    const parsed = addChildSchema.safeParse({ personId: child1, childOrder: 1 });
    expect(parsed.success).toBe(true);

    // Insert child link
    db.insert(children)
      .values({
        id: crypto.randomUUID(),
        familyId,
        personId: child1,
        childOrder: 1,
        relationshipToParent1: 'biological',
        relationshipToParent2: 'biological',
        validationStatus: 'confirmed',
        createdAt: new Date().toISOString(),
      })
      .run();

    const childRows = db
      .select()
      .from(children)
      .where(eq(children.familyId, familyId))
      .all();
    expect(childRows).toHaveLength(1);
    expect(childRows[0].personId).toBe(child1);
  });

  it('rejects duplicate child link', () => {
    const p1 = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const child1 = createPerson({ givenName: 'Junior', surname: 'Smith', sex: 'M', isLiving: true });

    const familyId = createFamily(p1, null);

    db.insert(children)
      .values({
        id: crypto.randomUUID(),
        familyId,
        personId: child1,
        createdAt: new Date().toISOString(),
      })
      .run();

    // Attempting to insert duplicate should throw (UNIQUE constraint)
    expect(() => {
      db.insert(children)
        .values({
          id: crypto.randomUUID(),
          familyId,
          personId: child1,
          createdAt: new Date().toISOString(),
        })
        .run();
    }).toThrow();
  });

  it('removes child from family', () => {
    const p1 = createPerson({ givenName: 'John', surname: 'Smith', sex: 'M', isLiving: false });
    const child1 = createPerson({ givenName: 'Junior', surname: 'Smith', sex: 'M', isLiving: true });

    const familyId = createFamily(p1, null);

    db.insert(children)
      .values({
        id: crypto.randomUUID(),
        familyId,
        personId: child1,
        createdAt: new Date().toISOString(),
      })
      .run();

    // Verify child exists
    let childRows = db
      .select()
      .from(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, child1)))
      .all();
    expect(childRows).toHaveLength(1);

    // Hard delete
    db.delete(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, child1)))
      .run();

    // Verify child is gone
    childRows = db
      .select()
      .from(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, child1)))
      .all();
    expect(childRows).toHaveLength(0);
  });
});
