import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread, getThreadTimeline, cascade } from '../threads';

const FULL_DDL = `
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
  CREATE TABLE research_facts (
    id TEXT PRIMARY KEY,
    person_id TEXT,
    fact_type TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    fact_date_sort INTEGER,
    research_item_id TEXT,
    source_citation_id TEXT,
    factsheet_id TEXT,
    accepted INTEGER,
    confidence TEXT NOT NULL DEFAULT 'medium',
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](FULL_DDL);
});

async function seedFactsheet(d: TestCentralDb, id: string, title: string) {
  const now = new Date().toISOString();
  await d.run(sql`
    INSERT INTO factsheets (id, title, entity_type, status, created_by, created_at, updated_at)
    VALUES (${id}, ${title}, 'person', 'draft', 'u1', ${now}, ${now})
  `);
}

async function seedFact(d: TestCentralDb, id: string, factsheetId: string, factType: string, factValue: string) {
  const now = new Date().toISOString();
  await d.run(sql`
    INSERT INTO research_facts (id, fact_type, fact_value, factsheet_id, confidence, extraction_method, created_at, updated_at)
    VALUES (${id}, ${factType}, ${factValue}, ${factsheetId}, 'medium', 'manual', ${now}, ${now})
  `);
}

describe('cascade integration: John → Maria → Stefan', () => {
  it('records the full journey in the thread timeline', async () => {
    // 1. Start a thread
    const thread = await createThread(db as any, { title: "Find John's family", createdBy: 'u1' });

    // 2. Seed John factsheet + spouse_name fact
    await seedFactsheet(db, 'fs-john', 'John Smith');
    await seedFact(db, 'fact-john-spouse', 'fs-john', 'spouse_name', 'Maria');

    // 3. Cascade John → Maria (spouse)
    const r1 = await cascade(db as any, {
      threadId: thread.id,
      sourceFactsheetId: 'fs-john',
      sourceFactId: 'fact-john-spouse',
      newFactsheetTitle: 'Maria (spouse of John Smith)',
      relationshipType: 'spouse',
      reason: 'spouse mentioned in marriage cert',
      actorId: 'u1',
    });
    expect(r1.eventsEmitted).toBe(3);

    // 4. Seed Maria's parent_name fact
    await seedFact(db, 'fact-maria-parent', r1.factsheetId, 'parent_name', 'Stefan');

    // 5. Cascade Maria → Stefan (parent_child; Maria is the source/parent in our cascade direction
    //    even though semantically Stefan is the parent — the cascade's parent_child direction is
    //    from=source, to=new. For this integration test we exercise the function; UI Phase 2.5
    //    will handle the inversion for parent_name fact-type.)
    const r2 = await cascade(db as any, {
      threadId: thread.id,
      sourceFactsheetId: r1.factsheetId,
      sourceFactId: 'fact-maria-parent',
      newFactsheetTitle: 'Stefan (parent of Maria)',
      relationshipType: 'parent_child',
      reason: 'parent mentioned in death cert',
      actorId: 'u1',
    });
    expect(r2.eventsEmitted).toBe(3);

    // 6. Verify timeline (6 cascade events total)
    const timeline = await getThreadTimeline(db as any, thread.id);
    const types = timeline.map(e => e.eventType);
    expect(types.filter(t => t === 'factsheet_created')).toHaveLength(2);
    expect(types.filter(t => t === 'factsheet_linked')).toHaveLength(2);
    expect(types.filter(t => t === 'mention_followed')).toHaveLength(2);

    // Verify chronological order: all of cascade1's events come before any of cascade2's
    const cascade1Events = timeline.slice(0, 3);
    const cascade2Events = timeline.slice(3, 6);
    expect(cascade1Events.every(e => e.factsheetId === r1.factsheetId)).toBe(true);
    expect(cascade2Events.every(e => e.factsheetId === r2.factsheetId)).toBe(true);

    // Verify factsheet rows exist
    const allFactsheets = await db.all(sql`SELECT id, title, created_thread_id FROM factsheets ORDER BY created_at`) as any[];
    expect(allFactsheets).toHaveLength(3);  // John + Maria + Stefan
    expect(allFactsheets.find(f => f.id === r1.factsheetId)?.title).toBe('Maria (spouse of John Smith)');
    expect(allFactsheets.find(f => f.id === r2.factsheetId)?.title).toBe('Stefan (parent of Maria)');
    expect(allFactsheets.find(f => f.id === r1.factsheetId)?.created_thread_id).toBe(thread.id);
    expect(allFactsheets.find(f => f.id === r2.factsheetId)?.created_thread_id).toBe(thread.id);

    // Verify factsheet_links: 2 links, John→Maria spouse, Maria→Stefan parent_child
    const allLinks = await db.all(sql`SELECT * FROM factsheet_links ORDER BY created_at`) as any[];
    expect(allLinks).toHaveLength(2);
    expect(allLinks[0].from_factsheet_id).toBe('fs-john');
    expect(allLinks[0].to_factsheet_id).toBe(r1.factsheetId);
    expect(allLinks[0].relationship_type).toBe('spouse');
    expect(allLinks[1].from_factsheet_id).toBe(r1.factsheetId);
    expect(allLinks[1].to_factsheet_id).toBe(r2.factsheetId);
    expect(allLinks[1].relationship_type).toBe('parent_child');
  });
});
