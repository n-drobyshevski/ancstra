import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { executeComputeRelationship } from '../tools/compute-relationship';

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE persons (
      id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT,
      created_by TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE person_names (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      name_type TEXT NOT NULL DEFAULT 'birth', prefix TEXT,
      given_name TEXT NOT NULL, surname TEXT NOT NULL,
      suffix TEXT, nickname TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE families (
      id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT,
      relationship_type TEXT NOT NULL DEFAULT 'unknown',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE children (
      id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL,
      child_order INTEGER, relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
      relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
      validation_status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(family_id, person_id)
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY, event_type TEXT NOT NULL,
      date_original TEXT, date_sort INTEGER, date_modifier TEXT DEFAULT 'exact',
      date_end_sort INTEGER, place_text TEXT, description TEXT,
      person_id TEXT, family_id TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
  `);

  const now = new Date().toISOString();
  db.insert(schema.users)
    .values({ id: 'user-1', email: 'test@test.com', name: 'Test', createdAt: now, updatedAt: now })
    .run();

  // Grandparent
  db.insert(schema.persons).values({ id: 'gp', sex: 'M', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-gp', personId: 'gp', givenName: 'Johann', surname: 'Mueller', isPrimary: true, createdAt: now }).run();

  // Parent
  db.insert(schema.persons).values({ id: 'p', sex: 'M', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-p', personId: 'p', givenName: 'Friedrich', surname: 'Mueller', isPrimary: true, createdAt: now }).run();

  // Child 1
  db.insert(schema.persons).values({ id: 'c1', sex: 'M', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-c1', personId: 'c1', givenName: 'Hans', surname: 'Mueller', isPrimary: true, createdAt: now }).run();

  // Child 2 (sibling of c1)
  db.insert(schema.persons).values({ id: 'c2', sex: 'F', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-c2', personId: 'c2', givenName: 'Anna', surname: 'Mueller', isPrimary: true, createdAt: now }).run();

  // Unrelated
  db.insert(schema.persons).values({ id: 'u', sex: 'M', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-u', personId: 'u', givenName: 'Unrelated', surname: 'Person', isPrimary: true, createdAt: now }).run();

  // Family: gp -> p
  db.insert(schema.families).values({ id: 'fam-1', partner1Id: 'gp', createdAt: now, updatedAt: now }).run();
  db.insert(schema.children).values({ id: 'cl-1', familyId: 'fam-1', personId: 'p', createdAt: now }).run();

  // Family: p -> c1, c2
  db.insert(schema.families).values({ id: 'fam-2', partner1Id: 'p', createdAt: now, updatedAt: now }).run();
  db.insert(schema.children).values({ id: 'cl-2', familyId: 'fam-2', personId: 'c1', createdAt: now }).run();
  db.insert(schema.children).values({ id: 'cl-3', familyId: 'fam-2', personId: 'c2', createdAt: now }).run();
});

afterEach(() => {
  sqlite.close();
});

describe('computeRelationship', () => {
  it('computes parent relationship', async () => {
    const result = await executeComputeRelationship(db as any, 'c1', 'p');
    expect(result.relationship).toBe('child');
  });

  it('computes child relationship', async () => {
    const result = await executeComputeRelationship(db as any, 'p', 'c1');
    expect(result.relationship).toBe('parent');
  });

  it('computes sibling relationship', async () => {
    const result = await executeComputeRelationship(db as any, 'c1', 'c2');
    expect(result.relationship).toBe('sibling');
  });

  it('computes grandparent relationship', async () => {
    const result = await executeComputeRelationship(db as any, 'c1', 'gp');
    expect(result.relationship).toBe('grandchild');
  });

  it('returns no relationship for unrelated persons', async () => {
    const result = await executeComputeRelationship(db as any, 'c1', 'u');
    expect(result.relationship).toBe('no relationship found');
    expect(result.commonAncestor).toBeNull();
  });
});
