import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';
import { getThread } from '../threads/queries';
import { getThreadTimeline } from '../threads/events';
import { pauseThread, resolveThread, abandonThread } from '../threads/lifecycle';

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
`;

let db: TestCentralDb;
beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('pauseThread', () => {
  it('flips status and emits thread_paused event', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await pauseThread(db as any, t.id, 'u1');
    const refreshed = await getThread(db as any, t.id);
    expect(refreshed!.status).toBe('paused');
    expect(refreshed!.closedAt).toBeNull();
    const events = await getThreadTimeline(db as any, t.id);
    expect(events.find(e => e.eventType === 'thread_paused')).toBeDefined();
  });
});

describe('resolveThread', () => {
  it('flips status, sets closedAt, emits thread_resolved', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await resolveThread(db as any, t.id, 'u1');
    const refreshed = await getThread(db as any, t.id);
    expect(refreshed!.status).toBe('resolved');
    expect(refreshed!.closedAt).toBeTruthy();
  });
});

describe('abandonThread', () => {
  it('flips status, sets closedAt, emits thread_abandoned with reason', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await abandonThread(db as any, t.id, 'u1', 'lead went cold');
    const refreshed = await getThread(db as any, t.id);
    expect(refreshed!.status).toBe('abandoned');
    expect(refreshed!.closedAt).toBeTruthy();
    const events = await getThreadTimeline(db as any, t.id);
    const ev = events.find(e => e.eventType === 'thread_abandoned');
    expect(ev?.reason).toBe('lead went cold');
  });
});
