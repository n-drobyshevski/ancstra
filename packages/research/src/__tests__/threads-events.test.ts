import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { eq } from 'drizzle-orm';
import { researchThreads } from '@ancstra/db';
import { createThread } from '../threads/create';
import { addEvent, getThreadTimeline, getThreadTimelinePage } from '../threads/events';

const DDL = `
  CREATE TABLE research_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    seed_person_id TEXT, seed_factsheet_id TEXT, seed_research_item_id TEXT,
    summary TEXT, created_by TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT
  );
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES research_threads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT,
    occurred_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('addEvent', () => {
  it('inserts an event and returns it', async () => {
    const thread = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    const evt = await addEvent(db as any, {
      threadId: thread.id,
      eventType: 'note_added',
      actorId: 'u1',
      reason: 'starting investigation',
    });
    expect(evt.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(evt.threadId).toBe(thread.id);
    expect(evt.eventType).toBe('note_added');
    expect(evt.reason).toBe('starting investigation');
    expect(evt.occurredAt).toBeTruthy();
  });

  it('rejects events for nonexistent thread', async () => {
    await expect(addEvent(db as any, {
      threadId: 'nonexistent',
      eventType: 'note_added',
      actorId: 'u1',
    })).rejects.toThrow();
  });

  it('serializes payload to JSON', async () => {
    const thread = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    const evt = await addEvent(db as any, {
      threadId: thread.id,
      eventType: 'note_added',
      actorId: 'u1',
      payload: { foo: 'bar', n: 42 },
    });
    expect(JSON.parse(evt.payloadJson!)).toEqual({ foo: 'bar', n: 42 });
  });

  it('bumps thread updatedAt transactionally on success', async () => {
    const thread = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    const originalUpdatedAt = thread.updatedAt;

    // Small delay to ensure the timestamp differs
    await new Promise(r => setTimeout(r, 5));

    await addEvent(db as any, {
      threadId: thread.id,
      eventType: 'note_added',
      actorId: 'u1',
      reason: 'transaction test',
    });

    const rows = await (db as any).select().from(researchThreads)
      .where(eq(researchThreads.id, thread.id))
      .all();
    expect(rows[0].updatedAt).not.toBe(originalUpdatedAt);
    expect(rows[0].updatedAt > originalUpdatedAt).toBe(true);
  });
});

describe('getThreadTimeline (M2M)', () => {
  it('returns only events for the requested thread', async () => {
    const t1 = await createThread(db as any, { title: 'T1', createdBy: 'u1' });
    const t2 = await createThread(db as any, { title: 'T2', createdBy: 'u1' });
    const SHARED = 'fs-shared';

    await addEvent(db as any, { threadId: t1.id, eventType: 'factsheet_created', actorId: 'u1', factsheetId: SHARED });
    await addEvent(db as any, { threadId: t2.id, eventType: 'factsheet_linked', actorId: 'u1', factsheetId: SHARED });
    await addEvent(db as any, { threadId: t1.id, eventType: 'note_added', actorId: 'u1' });

    const t1Events = await getThreadTimeline(db as any, t1.id);
    const t2Events = await getThreadTimeline(db as any, t2.id);

    expect(t1Events).toHaveLength(2);
    expect(t1Events.map(e => e.eventType)).toEqual(['factsheet_created', 'note_added']);
    expect(t2Events).toHaveLength(1);
    expect(t2Events[0].eventType).toBe('factsheet_linked');
    expect(t1Events[0].factsheetId).toBe(SHARED);
    expect(t2Events[0].factsheetId).toBe(SHARED);
  });

  it('orders events chronologically', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'thread_started', actorId: 'u1' });
    await new Promise(r => setTimeout(r, 5));
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });
    await new Promise(r => setTimeout(r, 5));
    await addEvent(db as any, { threadId: t.id, eventType: 'factsheet_created', actorId: 'u1' });
    const events = await getThreadTimeline(db as any, t.id);
    expect(events.map(e => e.eventType)).toEqual(['thread_started', 'note_added', 'factsheet_created']);
  });
});

describe('getThreadTimelinePage (cursor-paginated, DESC)', () => {
  it('returns newest-first and surfaces nextCursor when more rows exist', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    // Insert 4 events with strictly increasing occurredAt (5ms apart)
    await addEvent(db as any, { threadId: t.id, eventType: 'thread_started', actorId: 'u1' });
    await new Promise(r => setTimeout(r, 5));
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', reason: 'first note' });
    await new Promise(r => setTimeout(r, 5));
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', reason: 'second note' });
    await new Promise(r => setTimeout(r, 5));
    await addEvent(db as any, { threadId: t.id, eventType: 'factsheet_created', actorId: 'u1' });

    const page1 = await getThreadTimelinePage(db as any, t.id, { limit: 2 });
    expect(page1.events).toHaveLength(2);
    // DESC by occurredAt → latest first
    expect(page1.events[0].eventType).toBe('factsheet_created');
    expect(page1.events[1].reason).toBe('second note');
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getThreadTimelinePage(db as any, t.id, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.events).toHaveLength(2);
    expect(page2.events[0].reason).toBe('first note');
    expect(page2.events[1].eventType).toBe('thread_started');
    expect(page2.nextCursor).toBeNull();
  });

  it('returns nextCursor=null when the page exactly drains the table', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1' });

    const page = await getThreadTimelinePage(db as any, t.id, { limit: 2 });
    expect(page.events).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });
});
