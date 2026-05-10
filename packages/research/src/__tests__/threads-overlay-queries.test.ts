import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { sql } from 'drizzle-orm';
import { createThread, addEvent } from '../threads';
import { getPersonsTouchedByThread, getThreadsForPerson } from '../threads/queries';

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
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

async function seedFactsheet(d: TestCentralDb, id: string, threadId: string | null, promotedPersonId: string | null) {
  const now = new Date().toISOString();
  await d.run(sql`
    INSERT INTO factsheets (id, title, entity_type, status, created_thread_id, promoted_person_id, created_by, created_at, updated_at)
    VALUES (${id}, ${'fs ' + id}, 'person', ${promotedPersonId ? 'promoted' : 'draft'}, ${threadId}, ${promotedPersonId}, 'u1', ${now}, ${now})
  `);
}

describe('getPersonsTouchedByThread', () => {
  it('returns union of (a) promoted persons from thread-created factsheets and (b) event-referenced persons', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await seedFactsheet(db, 'fs-a', t.id, 'p-a');   // (a) thread-created + promoted
    await seedFactsheet(db, 'fs-b', t.id, null);     // (a) thread-created but not promoted (excluded)
    await seedFactsheet(db, 'fs-c', null, 'p-c');    // not thread-created (excluded)
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', personId: 'p-d' });  // (b)

    const ids = await getPersonsTouchedByThread(db as any, t.id);
    expect(ids.sort()).toEqual(['p-a', 'p-d'].sort());
  });

  it('returns empty array for unknown thread', async () => {
    const ids = await getPersonsTouchedByThread(db as any, 'missing');
    expect(ids).toEqual([]);
  });

  it('deduplicates persons referenced by both factsheet and event', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await seedFactsheet(db, 'fs-a', t.id, 'p-shared');
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', personId: 'p-shared' });

    const ids = await getPersonsTouchedByThread(db as any, t.id);
    expect(ids).toEqual(['p-shared']);
  });
});

describe('getThreadsForPerson', () => {
  it('returns all threads referenced via promoted factsheet or event personId, with last-touched timestamp', async () => {
    const t1 = await createThread(db as any, { title: 'T1', createdBy: 'u1' });
    const t2 = await createThread(db as any, { title: 'T2', createdBy: 'u1' });
    await seedFactsheet(db, 'fs-a', t1.id, 'p-shared');
    await addEvent(db as any, { threadId: t2.id, eventType: 'note_added', actorId: 'u1', personId: 'p-shared' });

    const threads = await getThreadsForPerson(db as any, 'p-shared');
    expect(threads.map(t => t.id).sort()).toEqual([t1.id, t2.id].sort());
    threads.forEach(t => expect(t.lastTouchedAt).toBeTruthy());
  });

  it('returns empty array for an untouched person', async () => {
    const threads = await getThreadsForPerson(db as any, 'p-orphan');
    expect(threads).toEqual([]);
  });

  it('orders threads by last-touched DESC', async () => {
    const t1 = await createThread(db as any, { title: 'T1', createdBy: 'u1' });
    const t2 = await createThread(db as any, { title: 'T2', createdBy: 'u1' });

    await addEvent(db as any, { threadId: t1.id, eventType: 'note_added', actorId: 'u1', personId: 'p-x' });
    // wait so timestamps differ
    await new Promise(r => setTimeout(r, 25));
    await addEvent(db as any, { threadId: t2.id, eventType: 'note_added', actorId: 'u1', personId: 'p-x' });

    const threads = await getThreadsForPerson(db as any, 'p-x');
    expect(threads[0].id).toBe(t2.id);
    expect(threads[1].id).toBe(t1.id);
  });
});
