import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { executeAnalyzeTreeGaps } from '../tools/analyze-tree-gaps';

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
    CREATE TABLE sources (
      id TEXT PRIMARY KEY, title TEXT NOT NULL,
      author TEXT, publisher TEXT, publication_date TEXT,
      repository_name TEXT, repository_url TEXT, source_type TEXT, notes TEXT,
      created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE source_citations (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
      citation_detail TEXT, citation_text TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      person_id TEXT, event_id TEXT, family_id TEXT, person_name_id TEXT,
      created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
    );
  `);

  const now = new Date().toISOString();
  db.insert(schema.users)
    .values({ id: 'user-1', email: 'test@test.com', name: 'Test', createdAt: now, updatedAt: now })
    .run();

  // Complete person (has birth, death, parents, sources)
  db.insert(schema.persons).values({ id: 'complete', sex: 'M', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-complete', personId: 'complete', givenName: 'Complete', surname: 'Person', isPrimary: true, createdAt: now }).run();
  db.insert(schema.events).values({ id: 'e-complete-b', eventType: 'birth', dateSort: 18500101, personId: 'complete', createdAt: now, updatedAt: now }).run();
  db.insert(schema.events).values({ id: 'e-complete-d', eventType: 'death', dateSort: 19200101, personId: 'complete', createdAt: now, updatedAt: now }).run();

  // Parent of 'complete'
  db.insert(schema.persons).values({ id: 'parent', sex: 'M', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-parent', personId: 'parent', givenName: 'Parent', surname: 'Person', isPrimary: true, createdAt: now }).run();
  db.insert(schema.families).values({ id: 'fam-1', partner1Id: 'parent', createdAt: now, updatedAt: now }).run();
  db.insert(schema.children).values({ id: 'cl-1', familyId: 'fam-1', personId: 'complete', createdAt: now }).run();

  // Source for complete
  db.insert(schema.sources).values({ id: 'src-1', title: 'Census', createdAt: now, updatedAt: now }).run();
  db.insert(schema.sourceCitations).values({ id: 'cit-1', sourceId: 'src-1', personId: 'complete', createdAt: now }).run();

  // Person with all gaps (no birth, no death, no parents, no sources)
  db.insert(schema.persons).values({ id: 'gaps', sex: 'F', isLiving: false, createdAt: now, updatedAt: now }).run();
  db.insert(schema.personNames).values({ id: 'n-gaps', personId: 'gaps', givenName: 'Missing', surname: 'Data', isPrimary: true, createdAt: now }).run();
});

afterEach(() => {
  sqlite.close();
});

describe('analyzeTreeGaps', () => {
  it('identifies missing birth date', async () => {
    const gaps = await executeAnalyzeTreeGaps(db as any);
    const birthGaps = gaps.filter(g => g.gapType === 'missing_birth_date' && g.personId === 'gaps');
    expect(birthGaps.length).toBeGreaterThan(0);
  });

  it('identifies missing parents', async () => {
    const gaps = await executeAnalyzeTreeGaps(db as any);
    const parentGaps = gaps.filter(g => g.gapType === 'missing_parents' && g.personId === 'gaps');
    expect(parentGaps.length).toBeGreaterThan(0);
  });

  it('identifies missing sources', async () => {
    const gaps = await executeAnalyzeTreeGaps(db as any);
    const sourceGaps = gaps.filter(g => g.gapType === 'missing_sources' && g.personId === 'gaps');
    expect(sourceGaps.length).toBeGreaterThan(0);
  });

  it('does not flag complete person for birth gaps', async () => {
    const gaps = await executeAnalyzeTreeGaps(db as any);
    const completeGaps = gaps.filter(g => g.personId === 'complete' && g.gapType === 'missing_birth_date');
    expect(completeGaps).toHaveLength(0);
  });

  it('prioritizes high before medium before low', async () => {
    const gaps = await executeAnalyzeTreeGaps(db as any);
    const order = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < gaps.length; i++) {
      expect(order[gaps[i].priority]).toBeGreaterThanOrEqual(order[gaps[i - 1].priority]);
    }
  });

  it('works with specific person focus', async () => {
    const gaps = await executeAnalyzeTreeGaps(db as any, 'complete', 5);
    expect(gaps).toBeInstanceOf(Array);
  });
});
