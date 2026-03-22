import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@ancstra/db';
import {
  createResearchItem,
  getResearchItem,
  listResearchItems,
  updateResearchItemStatus,
  updateResearchItemNotes,
  tagPersonToItem,
  untagPersonFromItem,
  deleteResearchItem,
} from '../items/queries';

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
  `);

  // Seed test user
  db.insert(schema.users)
    .values({
      id: 'test-user-1',
      email: 'test@ancstra.app',
      passwordHash: '$2a$10$fakehash',
      name: 'Test User',
      createdAt: new Date().toISOString(),
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
});

afterEach(() => {
  sqlite.close();
});

describe('Research Items CRUD queries', () => {
  it('creates a research item', () => {
    const result = createResearchItem(db as any, {
      title: 'Census Record 1850',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });

    expect(result.id).toBeDefined();
    expect(result.title).toBe('Census Record 1850');
    expect(result.status).toBe('draft');
    expect(result.createdAt).toBeDefined();
  });

  it('gets a research item by id with personIds', () => {
    const created = createResearchItem(db as any, {
      title: 'Birth Certificate',
      discoveryMethod: 'paste_url',
      url: 'https://example.com/record',
      createdBy: 'test-user-1',
    });

    tagPersonToItem(db as any, created.id, 'person-1');
    tagPersonToItem(db as any, created.id, 'person-2');

    const item = getResearchItem(db as any, created.id);
    expect(item).toBeDefined();
    expect(item!.title).toBe('Birth Certificate');
    expect(item!.url).toBe('https://example.com/record');
    expect(item!.personIds).toHaveLength(2);
    expect(item!.personIds).toContain('person-1');
    expect(item!.personIds).toContain('person-2');
  });

  it('returns null for nonexistent research item', () => {
    const item = getResearchItem(db as any, 'nonexistent');
    expect(item).toBeNull();
  });

  it('lists research items with status filter', () => {
    createResearchItem(db as any, {
      title: 'Draft Item',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });
    const promoted = createResearchItem(db as any, {
      title: 'Promoted Item',
      discoveryMethod: 'paste_text',
      createdBy: 'test-user-1',
    });
    updateResearchItemStatus(db as any, promoted.id, 'promoted');

    const allItems = listResearchItems(db as any);
    expect(allItems).toHaveLength(2);

    const draftItems = listResearchItems(db as any, { status: 'draft' });
    expect(draftItems).toHaveLength(1);
    expect(draftItems[0].title).toBe('Draft Item');

    const promotedItems = listResearchItems(db as any, { status: 'promoted' });
    expect(promotedItems).toHaveLength(1);
    expect(promotedItems[0].title).toBe('Promoted Item');
  });

  it('lists research items filtered by personId', () => {
    const item1 = createResearchItem(db as any, {
      title: 'Item for Person 1',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });
    const item2 = createResearchItem(db as any, {
      title: 'Item for Person 2',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });
    tagPersonToItem(db as any, item1.id, 'person-1');
    tagPersonToItem(db as any, item2.id, 'person-2');

    const person1Items = listResearchItems(db as any, { personId: 'person-1' });
    expect(person1Items).toHaveLength(1);
    expect(person1Items[0].title).toBe('Item for Person 1');
  });

  it('lists items ordered by createdAt desc', () => {
    createResearchItem(db as any, {
      title: 'First',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });
    createResearchItem(db as any, {
      title: 'Second',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });

    const items = listResearchItems(db as any);
    // Most recent first
    expect(items[0].title).toBe('Second');
    expect(items[1].title).toBe('First');
  });

  it('updates status', () => {
    const created = createResearchItem(db as any, {
      title: 'To Promote',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });

    updateResearchItemStatus(db as any, created.id, 'promoted');

    const item = getResearchItem(db as any, created.id);
    expect(item!.status).toBe('promoted');
  });

  it('updates notes', () => {
    const created = createResearchItem(db as any, {
      title: 'With Notes',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });

    updateResearchItemNotes(db as any, created.id, 'Important finding');

    const item = getResearchItem(db as any, created.id);
    expect(item!.notes).toBe('Important finding');
  });

  it('tags and untags persons', () => {
    const created = createResearchItem(db as any, {
      title: 'Tagging Test',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });

    tagPersonToItem(db as any, created.id, 'person-1');
    let item = getResearchItem(db as any, created.id);
    expect(item!.personIds).toHaveLength(1);
    expect(item!.personIds).toContain('person-1');

    tagPersonToItem(db as any, created.id, 'person-2');
    item = getResearchItem(db as any, created.id);
    expect(item!.personIds).toHaveLength(2);

    untagPersonFromItem(db as any, created.id, 'person-1');
    item = getResearchItem(db as any, created.id);
    expect(item!.personIds).toHaveLength(1);
    expect(item!.personIds).toContain('person-2');
  });

  it('deletes an item', () => {
    const created = createResearchItem(db as any, {
      title: 'To Delete',
      discoveryMethod: 'search',
      createdBy: 'test-user-1',
    });

    tagPersonToItem(db as any, created.id, 'person-1');

    deleteResearchItem(db as any, created.id);

    const item = getResearchItem(db as any, created.id);
    expect(item).toBeNull();
  });
});
