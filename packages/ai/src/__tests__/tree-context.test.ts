import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { buildTreeContext } from '../context/tree-context';

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
    CREATE INDEX idx_persons_sex ON persons(sex);
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
    CREATE INDEX idx_person_names_person ON person_names(person_id);
    CREATE TABLE families (
      id TEXT PRIMARY KEY,
      partner1_id TEXT REFERENCES persons(id),
      partner2_id TEXT REFERENCES persons(id),
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
      family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_events_person ON events(person_id, date_sort);
    CREATE TABLE sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      publication_date TEXT,
      repository_name TEXT,
      repository_url TEXT,
      source_type TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE source_citations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      citation_detail TEXT,
      citation_text TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      event_id TEXT,
      family_id TEXT,
      person_name_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();

  // Seed test user
  db.insert(schema.users)
    .values({ id: 'user-1', email: 'test@ancstra.app', passwordHash: '$2a$10$fakehash', name: 'Test User', createdAt: now })
    .run();

  // Seed grandparent
  db.insert(schema.persons)
    .values({ id: 'gp-1', sex: 'M', isLiving: false, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.personNames)
    .values({ id: 'name-gp-1', personId: 'gp-1', givenName: 'Johann', surname: 'Mueller', isPrimary: true, createdAt: now })
    .run();
  db.insert(schema.events)
    .values({ id: 'ev-gp-birth', eventType: 'birth', dateSort: 18200315, placeText: 'Berlin, Germany', personId: 'gp-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.events)
    .values({ id: 'ev-gp-death', eventType: 'death', dateSort: 18900101, personId: 'gp-1', createdAt: now, updatedAt: now })
    .run();

  // Seed parent
  db.insert(schema.persons)
    .values({ id: 'p-1', sex: 'M', isLiving: false, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.personNames)
    .values({ id: 'name-p-1', personId: 'p-1', givenName: 'Friedrich', surname: 'Mueller', isPrimary: true, createdAt: now })
    .run();
  db.insert(schema.events)
    .values({ id: 'ev-p-birth', eventType: 'birth', dateSort: 18500601, placeText: 'Hamburg, Germany', personId: 'p-1', createdAt: now, updatedAt: now })
    .run();

  // Seed child (focus person)
  db.insert(schema.persons)
    .values({ id: 'c-1', sex: 'M', isLiving: false, createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.personNames)
    .values({ id: 'name-c-1', personId: 'c-1', givenName: 'Hans', surname: 'Mueller', isPrimary: true, createdAt: now })
    .run();
  db.insert(schema.events)
    .values({ id: 'ev-c-birth', eventType: 'birth', dateSort: 18800101, placeText: 'New York, USA', personId: 'c-1', createdAt: now, updatedAt: now })
    .run();

  // Create family relationships: gp-1 -> p-1 -> c-1
  db.insert(schema.families)
    .values({ id: 'fam-1', partner1Id: 'gp-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.children)
    .values({ id: 'child-link-1', familyId: 'fam-1', personId: 'p-1', createdAt: now })
    .run();
  db.insert(schema.families)
    .values({ id: 'fam-2', partner1Id: 'p-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.children)
    .values({ id: 'child-link-2', familyId: 'fam-2', personId: 'c-1', createdAt: now })
    .run();

  // Add a source citation for one person
  db.insert(schema.sources)
    .values({ id: 'src-1', title: 'Census 1850', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.sourceCitations)
    .values({ id: 'cit-1', sourceId: 'src-1', personId: 'gp-1', createdAt: now })
    .run();
});

afterEach(() => {
  sqlite.close();
});

describe('buildTreeContext', () => {
  it('returns summary with person count', async () => {
    const ctx = await buildTreeContext(db as any);
    expect(ctx.summary).toContain('persons');
    expect(ctx.summary).toContain('3');
  });

  it('includes key persons from direct line', async () => {
    const ctx = await buildTreeContext(db as any, 'c-1');
    expect(ctx.keyPersons.length).toBeGreaterThan(0);
    expect(ctx.keyPersons.length).toBeLessThanOrEqual(50);
    // Should include the focus person
    expect(ctx.keyPersons.some(p => p.name.includes('Hans'))).toBe(true);
  });

  it('identifies research gaps', async () => {
    const ctx = await buildTreeContext(db as any);
    expect(ctx.gaps).toBeInstanceOf(Array);
  });

  it('respects token budget by limiting key persons', async () => {
    const ctx = await buildTreeContext(db as any, undefined, 500);
    // With very low budget, fewer persons should be included
    expect(ctx.keyPersons.length).toBeLessThanOrEqual(12);
  });

  it('returns valid TreeContext shape', async () => {
    const ctx = await buildTreeContext(db as any);
    expect(ctx).toHaveProperty('summary');
    expect(ctx).toHaveProperty('keyPersons');
    expect(ctx).toHaveProperty('gaps');
    expect(ctx).toHaveProperty('recentActivity');
    expect(ctx).toHaveProperty('tokenBudget');
  });

  it('includes earliest ancestor in summary', async () => {
    const ctx = await buildTreeContext(db as any);
    expect(ctx.summary).toContain('Johann Mueller');
    expect(ctx.summary).toContain('1820');
  });

  it('includes sourced percentage in summary', async () => {
    const ctx = await buildTreeContext(db as any);
    expect(ctx.summary).toContain('sourced');
  });
});
