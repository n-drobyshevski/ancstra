import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { createThread, addEvent } from '@ancstra/research';
import { createSuggestNextStepTool } from '../tools/research/suggest-next-step';

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

describe('suggest_next_step tool', () => {
  it('returns thread context + instruction asking for 3 ranked options', async () => {
    const t = await createThread(db as any, { title: 'Find John', createdBy: 'u1', seedPersonId: 'p-john' });
    await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', reason: 'starting' });

    const tool = createSuggestNextStepTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: t.id }, {} as any);

    expect(res.threadTitle).toBe('Find John');
    expect(res.seedPersonId).toBe('p-john');
    expect(res.recentEvents).toHaveLength(1);
    expect(res.instruction).toContain('"options"');
    expect(res.instruction).toContain('exactly 3 ranked next steps');
    expect(res.instruction).toContain('suggestedTool');
  });

  it('returns error for unknown thread', async () => {
    const tool = createSuggestNextStepTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: 'missing' }, {} as any);
    expect(res.error).toContain('not found');
  });

  it('caps recentEvents to last 15 entries', async () => {
    const t = await createThread(db as any, { title: 'Long', createdBy: 'u1' });
    for (let i = 0; i < 30; i++) {
      await addEvent(db as any, { threadId: t.id, eventType: 'note_added', actorId: 'u1', reason: `n${i}` });
    }
    const tool = createSuggestNextStepTool(db as any);
    const res: any = await (tool.execute as any)({ threadId: t.id }, {} as any);
    expect(res.recentEvents.length).toBeLessThanOrEqual(15);
  });
});
