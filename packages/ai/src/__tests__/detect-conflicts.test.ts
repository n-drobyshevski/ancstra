import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db/schema';
import { createFact } from '@ancstra/research';
import { executeDetectConflicts } from '../tools/research/detect-conflicts';

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle({ client: sqlite, schema });

  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, name TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE persons (
      id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT,
      created_by TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted_at TEXT
    );
    CREATE TABLE sources (
      id TEXT PRIMARY KEY, title TEXT NOT NULL,
      author TEXT, publisher TEXT, publication_date TEXT,
      repository_name TEXT, repository_url TEXT, source_type TEXT, notes TEXT,
      created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE source_citations (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
      citation_detail TEXT, citation_text TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      person_id TEXT, event_id TEXT, family_id TEXT, person_name_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE search_providers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, provider_type TEXT NOT NULL,
      base_url TEXT, is_enabled INTEGER NOT NULL DEFAULT 1, config TEXT,
      rate_limit_rpm INTEGER NOT NULL DEFAULT 30,
      health_status TEXT NOT NULL DEFAULT 'unknown',
      last_health_check TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE research_items (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT, snippet TEXT,
      full_text TEXT, notes TEXT, archived_html_path TEXT, screenshot_path TEXT,
      archived_at TEXT, provider_id TEXT, provider_record_id TEXT,
      discovery_method TEXT NOT NULL, search_query TEXT,
      status TEXT NOT NULL DEFAULT 'draft', promoted_source_id TEXT,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE research_item_persons (
      research_item_id TEXT NOT NULL, person_id TEXT NOT NULL,
      PRIMARY KEY (research_item_id, person_id)
    );
    CREATE TABLE research_facts (
      id TEXT PRIMARY KEY, person_id TEXT NOT NULL,
      fact_type TEXT NOT NULL, fact_value TEXT NOT NULL,
      fact_date_sort INTEGER, research_item_id TEXT,
      source_citation_id TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      extraction_method TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_research_facts_person ON research_facts(person_id);
    CREATE INDEX idx_research_facts_person_type ON research_facts(person_id, fact_type);
  `);

  const now = new Date().toISOString();
  db.insert(schema.users)
    .values({ id: 'user-1', email: 'test@test.com', passwordHash: 'hash', name: 'Test', createdAt: now })
    .run();

  db.insert(schema.persons)
    .values({ id: 'person-123', sex: 'M', isLiving: false, createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.persons)
    .values({ id: 'person-no-conflicts', sex: 'F', isLiving: false, createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.persons)
    .values({ id: 'person-456', sex: 'M', isLiving: false, createdAt: now, updatedAt: now })
    .run();

  db.insert(schema.researchItems)
    .values({ id: 'item-a', title: 'Source A', discoveryMethod: 'search', createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.researchItems)
    .values({ id: 'item-b', title: 'Source B', discoveryMethod: 'search', createdBy: 'user-1', createdAt: now, updatedAt: now })
    .run();

  // Conflicting birth dates
  createFact(db as any, { personId: 'person-123', factType: 'birth_date', factValue: '1850', researchItemId: 'item-a', confidence: 'high' });
  createFact(db as any, { personId: 'person-123', factType: 'birth_date', factValue: '1852', researchItemId: 'item-b', confidence: 'medium' });

  // Non-conflicting
  createFact(db as any, { personId: 'person-no-conflicts', factType: 'birth_date', factValue: '1860', researchItemId: 'item-a' });

  // Multi-valued (not conflicts)
  createFact(db as any, { personId: 'person-456', factType: 'residence', factValue: 'New York, NY', researchItemId: 'item-a' });
  createFact(db as any, { personId: 'person-456', factType: 'residence', factValue: 'Boston, MA', researchItemId: 'item-b' });
});

afterEach(() => {
  sqlite.close();
});

describe('detectConflicts', () => {
  it('detects conflicting birth dates', async () => {
    const conflicts = await executeDetectConflicts(db as any, 'person-123');
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].factType).toBe('birth_date');
    expect(conflicts[0].values).toHaveLength(2);
  });

  it('ignores multi-valued types', async () => {
    const conflicts = await executeDetectConflicts(db as any, 'person-456');
    const residenceConflicts = conflicts.filter(c => c.factType === 'residence');
    expect(residenceConflicts).toHaveLength(0);
  });

  it('returns empty for no conflicts', async () => {
    const conflicts = await executeDetectConflicts(db as any, 'person-no-conflicts');
    expect(conflicts).toHaveLength(0);
  });

  it('includes suggestion text', async () => {
    const conflicts = await executeDetectConflicts(db as any, 'person-123');
    expect(conflicts[0].suggestion).toBeTruthy();
    expect(conflicts[0].suggestion.length).toBeGreaterThan(0);
  });
});
