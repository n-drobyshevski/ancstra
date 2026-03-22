import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db';
import { createFact } from '../facts/queries.js';
import { detectConflicts, resolveConflict, MULTI_VALUED_TYPES } from '../facts/conflicts.js';

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
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      fact_type TEXT NOT NULL,
      fact_value TEXT NOT NULL,
      fact_date_sort INTEGER,
      research_item_id TEXT REFERENCES research_items(id),
      source_citation_id TEXT REFERENCES source_citations(id),
      confidence TEXT NOT NULL DEFAULT 'medium',
      extraction_method TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_research_facts_person ON research_facts(person_id);
    CREATE INDEX idx_research_facts_person_type ON research_facts(person_id, fact_type);
  `);

  // Seed test user
  const now = new Date().toISOString();
  db.insert(schema.users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: now,
    })
    .run();

  // Seed test person
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

  // Seed research items
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

describe('Conflict Detection', () => {
  it('detects conflicting birth dates from different sources', () => {
    createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1850-03-15',
      researchItemId: 'item-1',
      confidence: 'medium',
    });
    createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1851-06-20',
      researchItemId: 'item-2',
      confidence: 'low',
    });

    const conflicts = detectConflicts(db as any, 'person-1');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].factType).toBe('birth_date');
    const values = [conflicts[0].valueA, conflicts[0].valueB].sort();
    expect(values).toEqual(['1850-03-15', '1851-06-20']);
    expect(conflicts[0].factAId).toBeDefined();
    expect(conflicts[0].factBId).toBeDefined();
  });

  it('does NOT flag matching values as conflicts', () => {
    createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1850-03-15',
      researchItemId: 'item-1',
    });
    createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1850-03-15',
      researchItemId: 'item-2',
    });

    const conflicts = detectConflicts(db as any, 'person-1');
    expect(conflicts).toHaveLength(0);
  });

  it('excludes multi-valued types (residence with different values = no conflict)', () => {
    createFact(db as any, {
      personId: 'person-1',
      factType: 'residence',
      factValue: 'New York, NY',
      researchItemId: 'item-1',
    });
    createFact(db as any, {
      personId: 'person-1',
      factType: 'residence',
      factValue: 'Boston, MA',
      researchItemId: 'item-2',
    });

    const conflicts = detectConflicts(db as any, 'person-1');
    expect(conflicts).toHaveLength(0);
  });

  it('excludes all MULTI_VALUED_TYPES from conflict detection', () => {
    for (const factType of MULTI_VALUED_TYPES) {
      createFact(db as any, {
        personId: 'person-1',
        factType: factType as any,
        factValue: 'Value A',
        researchItemId: 'item-1',
      });
      createFact(db as any, {
        personId: 'person-1',
        factType: factType as any,
        factValue: 'Value B',
        researchItemId: 'item-2',
      });
    }

    const conflicts = detectConflicts(db as any, 'person-1');
    expect(conflicts).toHaveLength(0);
  });
});

describe('Conflict Resolution', () => {
  it('resolveConflict sets winner to high, loser to disputed', () => {
    const factA = createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1850-03-15',
      confidence: 'medium',
      researchItemId: 'item-1',
    });
    const factB = createFact(db as any, {
      personId: 'person-1',
      factType: 'birth_date',
      factValue: '1851-06-20',
      confidence: 'low',
      researchItemId: 'item-2',
    });

    resolveConflict(db as any, factA.id, factB.id);

    const facts = sqlite.prepare('SELECT id, confidence FROM research_facts ORDER BY id').all() as any[];
    const winner = facts.find((f: any) => f.id === factA.id);
    const loser = facts.find((f: any) => f.id === factB.id);

    expect(winner.confidence).toBe('high');
    expect(loser.confidence).toBe('disputed');
  });
});
