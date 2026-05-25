import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread } from '../threads/create';
import { getThreadTimeline } from '../threads/events';
import { cascade } from '../threads/cascade';

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
    cluster_promotion_id TEXT,
    created_thread_id TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE factsheet_links (
    id TEXT PRIMARY KEY,
    from_factsheet_id TEXT NOT NULL,
    to_factsheet_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    source_fact_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'medium',
    contested INTEGER NOT NULL DEFAULT 0,
    source_handle TEXT, target_handle TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(from_factsheet_id, to_factsheet_id, relationship_type)
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

async function seedFactsheet(d: TestCentralDb, id: string, title: string) {
  const now = new Date().toISOString();
  await d.run(sql`
    INSERT INTO factsheets (id, title, entity_type, status, created_by, created_at, updated_at)
    VALUES (${id}, ${title}, 'person', 'draft', 'u1', ${now}, ${now})
  `);
}

describe('cascade', () => {
  it('happy path: creates factsheet + link + 3 events with active thread', async () => {
    await seedFactsheet(db, 'fs-john', 'John Smith');
    const thread = await createThread(db as any, { title: 'T', createdBy: 'u1' });

    const result = await cascade(db as any, {
      threadId: thread.id,
      sourceFactsheetId: 'fs-john',
      sourceFactId: 'fact-marriage-cert',
      newFactsheetTitle: 'Maria (wife of John Smith)',
      relationshipType: 'spouse',
      reason: 'spouse mentioned in marriage cert',
      actorId: 'u1',
    });

    expect(result.factsheetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.linkId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.eventsEmitted).toBe(3);

    const fsRows = await db.all(sql`SELECT * FROM factsheets WHERE id = ${result.factsheetId}`) as any[];
    expect(fsRows[0].title).toBe('Maria (wife of John Smith)');
    expect(fsRows[0].created_thread_id).toBe(thread.id);

    const linkRows = await db.all(sql`SELECT * FROM factsheet_links WHERE id = ${result.linkId}`) as any[];
    expect(linkRows[0].from_factsheet_id).toBe('fs-john');
    expect(linkRows[0].to_factsheet_id).toBe(result.factsheetId);
    expect(linkRows[0].relationship_type).toBe('spouse');
    expect(linkRows[0].source_fact_id).toBe('fact-marriage-cert');

    const events = await getThreadTimeline(db as any, thread.id);
    const types = events.map(e => e.eventType);
    expect(types).toContain('factsheet_created');
    expect(types).toContain('factsheet_linked');
    expect(types).toContain('mention_followed');
  });

  it('no-active-thread path: creates factsheet + link, no events emit', async () => {
    await seedFactsheet(db, 'fs-john', 'John Smith');

    const result = await cascade(db as any, {
      threadId: null,
      sourceFactsheetId: 'fs-john',
      sourceFactId: 'fact-1',
      newFactsheetTitle: 'Maria',
      relationshipType: 'spouse',
      reason: 'wife mentioned',
      actorId: 'u1',
    });

    expect(result.factsheetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.eventsEmitted).toBe(0);
    const fsRows = await db.all(sql`SELECT * FROM factsheets WHERE id = ${result.factsheetId}`) as any[];
    expect(fsRows[0].created_thread_id).toBeNull();
    const allEvents = await db.all(sql`SELECT COUNT(*) as c FROM research_thread_events`) as any[];
    expect(allEvents[0].c).toBe(0);
  });

  it('rolls back factsheet on FK precheck failure', async () => {
    const before = await db.all(sql`SELECT COUNT(*) as c FROM factsheets`) as any[];
    await expect(cascade(db as any, {
      threadId: null,
      sourceFactsheetId: 'NONEXISTENT_SOURCE',
      sourceFactId: 'fact-1',
      newFactsheetTitle: 'Should not persist',
      relationshipType: 'spouse',
      reason: 'rollback test',
      actorId: 'u1',
    })).rejects.toThrow();
    const after = await db.all(sql`SELECT COUNT(*) as c FROM factsheets`) as any[];
    expect(after[0].c).toBe(before[0].c);
  });
});
