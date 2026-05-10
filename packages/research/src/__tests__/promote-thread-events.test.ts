import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread } from '../threads/create';
import { getThreadTimeline } from '../threads/events';
import { promoteSingleFactsheet } from '../factsheets/promote';

// Minimal family-DB DDL needed by promoteSingleFactsheet's reads + writes +
// refreshSummary's CTE. We seed only a `name` fact (no event-yielding facts,
// no research_items) to keep the surface small.
const DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT, seed_factsheet_id TEXT, seed_research_item_id TEXT,
    summary TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY, thread_id TEXT NOT NULL,
    event_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT, occurred_at TEXT NOT NULL
  );
  CREATE TABLE factsheets (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'person',
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT, promoted_person_id TEXT, promoted_at TEXT,
    created_thread_id TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY, person_id TEXT, fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL, fact_date_sort INTEGER,
    research_item_id TEXT, source_citation_id TEXT, factsheet_id TEXT,
    accepted INTEGER, confidence TEXT NOT NULL DEFAULT 'medium',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    url TEXT, snippet TEXT, full_text TEXT, notes TEXT,
    archived_html_path TEXT, screenshot_path TEXT, archived_at TEXT,
    provider_id TEXT, provider_record_id TEXT,
    discovery_method TEXT NOT NULL,
    search_query TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    promoted_source_id TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE persons (
    id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U',
    is_living INTEGER NOT NULL DEFAULT 1,
    privacy_level TEXT NOT NULL DEFAULT 'private',
    notes TEXT, created_by TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE person_names (
    id TEXT PRIMARY KEY, person_id TEXT NOT NULL,
    name_type TEXT NOT NULL DEFAULT 'birth',
    prefix TEXT, given_name TEXT NOT NULL, surname TEXT NOT NULL,
    suffix TEXT, nickname TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE events (
    id TEXT PRIMARY KEY, event_type TEXT NOT NULL,
    date_original TEXT, date_sort INTEGER, date_modifier TEXT DEFAULT 'exact',
    date_end_sort INTEGER, place_text TEXT, description TEXT,
    person_id TEXT, family_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE families (
    id TEXT PRIMARY KEY, partner1_id TEXT, partner2_id TEXT,
    relationship_type TEXT NOT NULL DEFAULT 'unknown',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE children (
    id TEXT PRIMARY KEY, family_id TEXT NOT NULL, person_id TEXT NOT NULL,
    child_order INTEGER,
    relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
    relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
    validation_status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE sources (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    repository_url TEXT, source_type TEXT,
    created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE source_citations (
    id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
    citation_detail TEXT, citation_text TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    person_id TEXT, event_id TEXT, family_id TEXT, person_name_id TEXT,
    created_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE person_summary (
    person_id TEXT PRIMARY KEY,
    given_name TEXT NOT NULL DEFAULT '',
    surname TEXT NOT NULL DEFAULT '',
    sex TEXT NOT NULL,
    is_living INTEGER NOT NULL,
    birth_date TEXT, death_date TEXT,
    birth_date_sort INTEGER, death_date_sort INTEGER,
    birth_place TEXT, death_place TEXT,
    spouse_count INTEGER NOT NULL DEFAULT 0,
    child_count INTEGER NOT NULL DEFAULT 0,
    parent_count INTEGER NOT NULL DEFAULT 0,
    has_name INTEGER NOT NULL DEFAULT 0,
    has_birth_event INTEGER NOT NULL DEFAULT 0,
    has_birth_place INTEGER NOT NULL DEFAULT 0,
    has_death_event INTEGER NOT NULL DEFAULT 0,
    has_source INTEGER NOT NULL DEFAULT 0,
    sources_count INTEGER NOT NULL DEFAULT 0,
    completeness INTEGER NOT NULL DEFAULT 0,
    validation TEXT NOT NULL DEFAULT 'confirmed',
    updated_at_sort TEXT,
    updated_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

async function seedFactsheetWithName(d: TestCentralDb, fsId: string, title: string) {
  const now = new Date().toISOString();
  await d.run(sql`
    INSERT INTO factsheets (id, title, entity_type, status, created_by, created_at, updated_at)
    VALUES (${fsId}, ${title}, 'person', 'draft', 'u1', ${now}, ${now})
  `);
  await d.run(sql`
    INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, confidence, extraction_method, created_at, updated_at)
    VALUES (${'fact-' + fsId}, 'name', ${title}, ${fsId}, 'high', 'manual', ${now}, ${now})
  `);
}

describe('promoteSingleFactsheet — thread event emission', () => {
  it('emits a factsheet_promoted event when an active threadId is provided', async () => {
    await seedFactsheetWithName(db, 'fs-1', 'John Smith');
    const thread = await createThread(db as any, { title: 'Find John', createdBy: 'u1' });

    const result = await promoteSingleFactsheet(db as any, {
      factsheetId: 'fs-1',
      mode: 'create',
      userId: 'u1',
      skipValidation: true,
      threadId: thread.id,
    });

    expect(result.personId).toBeTruthy();
    expect(result.mode).toBe('created');

    const events = await getThreadTimeline(db as any, thread.id);
    const promotedEvents = events.filter(e => e.eventType === 'factsheet_promoted');
    expect(promotedEvents).toHaveLength(1);
    expect(promotedEvents[0].factsheetId).toBe('fs-1');
    expect(promotedEvents[0].personId).toBe(result.personId);
    expect(promotedEvents[0].actorId).toBe('u1');
    expect(promotedEvents[0].reason).toContain('John Smith');
  });

  it('does NOT emit a thread event when threadId is omitted', async () => {
    await seedFactsheetWithName(db, 'fs-2', 'Jane Doe');
    const thread = await createThread(db as any, { title: 'Other thread', createdBy: 'u1' });

    await promoteSingleFactsheet(db as any, {
      factsheetId: 'fs-2',
      mode: 'create',
      userId: 'u1',
      skipValidation: true,
      // no threadId
    });

    const events = await getThreadTimeline(db as any, thread.id);
    const promotedEvents = events.filter(e => e.eventType === 'factsheet_promoted');
    expect(promotedEvents).toHaveLength(0);
  });

  it('still completes the promotion when thread event emission fails (unknown thread)', async () => {
    await seedFactsheetWithName(db, 'fs-3', 'Bob Brown');

    // Pass a non-existent threadId — addEvent will throw, but the promotion
    // result must still be returned (event is fire-and-forget).
    const result = await promoteSingleFactsheet(db as any, {
      factsheetId: 'fs-3',
      mode: 'create',
      userId: 'u1',
      skipValidation: true,
      threadId: 'thread-does-not-exist',
    });

    expect(result.personId).toBeTruthy();
    expect(result.mode).toBe('created');

    // Verify the person row exists
    const rows = await db.all<{ id: string }>(sql`
      SELECT id FROM persons WHERE id = ${result.personId}
    `);
    expect(rows).toHaveLength(1);
  });
});
