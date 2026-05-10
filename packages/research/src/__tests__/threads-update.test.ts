import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread } from '../threads/create';
import { getThread } from '../threads/queries';
import { updateThread } from '../threads/update';

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

describe('updateThread', () => {
  it('updates title and bumps updatedAt', async () => {
    const t = await createThread(db as any, { title: 'old', createdBy: 'u1' });
    const before = (await getThread(db as any, t.id))!.updatedAt;
    await new Promise(r => setTimeout(r, 5));
    await updateThread(db as any, t.id, { title: 'new title' });
    const after = await getThread(db as any, t.id);
    expect(after!.title).toBe('new title');
    expect(after!.updatedAt > before).toBe(true);
  });

  it('updates summary independently', async () => {
    const t = await createThread(db as any, { title: 'T', createdBy: 'u1' });
    await updateThread(db as any, t.id, { summary: 'narrative so far...' });
    const after = await getThread(db as any, t.id);
    expect(after!.summary).toBe('narrative so far...');
    expect(after!.title).toBe('T');
  });
});
