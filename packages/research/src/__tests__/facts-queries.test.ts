import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db/schema';
import {
  createFact,
  getFactsByPerson,
  getFactsByResearchItem,
  updateFact,
  deleteFact,
} from '../facts/queries';

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
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
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
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
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
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE search_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      base_url TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT,
      rate_limit_rpm INTEGER NOT NULL DEFAULT 30,
      health_status TEXT NOT NULL DEFAULT 'unknown',
      last_health_check TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE research_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT,
      snippet TEXT,
      full_text TEXT,
      notes TEXT,
      archived_html_path TEXT,
      screenshot_path TEXT,
      archived_at TEXT,
      provider_id TEXT REFERENCES search_providers(id),
      provider_record_id TEXT,
      discovery_method TEXT NOT NULL,
      search_query TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      promoted_source_id TEXT REFERENCES sources(id),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE research_item_persons (
      research_item_id TEXT NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      PRIMARY KEY (research_item_id, person_id)
    );
    CREATE TABLE research_facts (
      id TEXT PRIMARY KEY,
      person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
      fact_type TEXT NOT NULL,
      fact_value TEXT NOT NULL,
      fact_date_sort INTEGER,
      research_item_id TEXT REFERENCES research_items(id),
      source_citation_id TEXT REFERENCES source_citations(id),
      factsheet_id TEXT,
      accepted INTEGER,
      confidence TEXT NOT NULL DEFAULT 'medium',
      extraction_method TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_research_facts_person ON research_facts(person_id);
    CREATE INDEX idx_research_facts_person_type ON research_facts(person_id, fact_type);
  `);

  // Seed test user
  db.insert(schema.users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .run();

  // Seed test persons
  const now = new Date().toISOString();
  db.insert(schema.persons)
    .values({
      id: 'person-1',
      sex: 'M',
      isLiving: false,
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(schema.persons)
    .values({
      id: 'person-2',
      sex: 'F',
      isLiving: false,
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Seed a research item for linking
  db.insert(schema.researchItems)
    .values({
      id: 'item-1',
      title: 'Census Record 1850',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();
  db.insert(schema.researchItems)
    .values({
      id: 'item-2',
      title: 'Birth Certificate',
      discoveryMethod: 'paste_url',
      createdBy: 'test-user-1',
      createdAt: now,
      updatedAt: now,
    })
    .run();
});

afterEach(() => {
  sqlite.close();
});

describe('Research Facts CRUD queries', () => {
  it('creates a fact and returns it with generated ID', async () => {
    const result = await createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1850-03-15',
      factDateSort: 18500315,
      confidence: 'high',
      extractionMethod: 'manual',
    });

    expect(result.id).toBeDefined();
    expect(result.personId).toBe('person-1');
    expect(result.factType).toBe('birth_date');
    expect(result.factValue).toBe('1850-03-15');
    expect(result.factDateSort).toBe(18500315);
    expect(result.confidence).toBe('high');
    expect(result.createdAt).toBeDefined();
  });

  it('getFactsByPerson returns all facts ordered by factDateSort ASC', async () => {
    await createFact(db as any, {
      personId: 'person-1',
      factType: 'death_date',
      factValue: '1920-11-01',
      factDateSort: 19201101,
    });
    await createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1850-03-15',
      factDateSort: 18500315,
    });
    await createFact(db as any, {
      personId: 'person-1',
      factType: 'marriage_date',
      factValue: '1875-06-20',
      factDateSort: 18750620,
    });

    // Different person -- should not appear
    await createFact(db as any, {
      personId: 'person-2',
      factType: 'birth_date',
      factValue: '1855-01-01',
      factDateSort: 18550101,
    });

    const facts = await getFactsByPerson(db as any, 'person-1');
    expect(facts).toHaveLength(3);
    // Ordered by factDateSort ASC
    expect(facts[0].factType).toBe('birth_date');
    expect(facts[1].factType).toBe('marriage_date');
    expect(facts[2].factType).toBe('death_date');
  });

  it('getFactsByResearchItem returns facts linked to item', async () => {
    await createFact(db as any, {
      personId: 'person-1',
      factType: 'residence',
      factValue: 'New York, NY',
      researchItemId: 'item-1',
    });
    await createFact(db as any, {
      personId: 'person-1',
      factType: 'occupation',
      factValue: 'Farmer',
      researchItemId: 'item-1',
    });
    // Different item -- should not appear
    await createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1850-03-15',
      researchItemId: 'item-2',
    });

    const facts = await getFactsByResearchItem(db as any, 'item-1');
    expect(facts).toHaveLength(2);
    expect(facts.map((f) => f.factType).sort()).toEqual(['occupation', 'residence']);
  });

  it('updateFact changes confidence and value', async () => {
    const created = await createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_place',
      factValue: 'Boston, MA',
      confidence: 'low',
    });

    const updated = await updateFact(db as any, created.id, {
      confidence: 'high',
      factValue: 'Boston, Massachusetts',
    });

    expect(updated).toBeDefined();
    expect(updated!.confidence).toBe('high');
    expect(updated!.factValue).toBe('Boston, Massachusetts');
    expect(updated!.updatedAt).not.toBe(created.updatedAt);
  });

  it('deleteFact removes a fact', async () => {
    const created = await createFact(db as any, {
      personId: 'person-1',
      factType: 'occupation',
      factValue: 'Blacksmith',
    });

    await deleteFact(db as any, created.id);

    const facts = await getFactsByPerson(db as any, 'person-1');
    expect(facts).toHaveLength(0);
  });
});
