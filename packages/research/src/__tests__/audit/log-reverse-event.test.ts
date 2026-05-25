import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '@ancstra/db/test-fixtures';
import { logReverseEvent } from '../../audit/log-reverse-event';

const DDL = `
  CREATE TABLE research_threads (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE factsheets (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', cluster_promotion_id TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE persons (id TEXT PRIMARY KEY, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE research_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_by TEXT NOT NULL, discovery_method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'collected', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE research_facts (id TEXT PRIMARY KEY, fact_type TEXT NOT NULL, fact_value TEXT NOT NULL, confidence TEXT NOT NULL DEFAULT 'medium', contested INTEGER NOT NULL DEFAULT 0, provenance TEXT NOT NULL DEFAULT 'derived', extraction_method TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE sources (id TEXT PRIMARY KEY, title TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'other', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE factsheet_links (id TEXT PRIMARY KEY, from_factsheet_id TEXT NOT NULL, to_factsheet_id TEXT NOT NULL, relationship_type TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE research_thread_events (
    id TEXT PRIMARY KEY,
    thread_id TEXT REFERENCES research_threads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, actor_id TEXT NOT NULL,
    factsheet_id TEXT, person_id TEXT, research_item_id TEXT,
    research_fact_id TEXT, source_id TEXT, link_id TEXT,
    reason TEXT, payload_json TEXT, occurred_at TEXT NOT NULL
  );
  INSERT INTO factsheets (id, title, created_by, created_at, updated_at) VALUES ('fs1', 'Test', 'u', '2026-05-24', '2026-05-24');
  INSERT INTO persons (id, created_by, created_at, updated_at) VALUES ('p1', 'u', '2026-05-24', '2026-05-24');
  INSERT INTO research_facts (id, fact_type, fact_value, created_at, updated_at) VALUES ('rf1', 'birth_date', '1820', '2026-05-24', '2026-05-24');
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](DDL);
});

describe('logReverseEvent (Bundle B §6.2)', () => {
  it('inserts a row with factsheet_id populated for factsheet_unmerged', async () => {
    const id = await logReverseEvent({
      db: db as any,
      eventType: 'factsheet_unmerged',
      reason: 'Wrong person',
      actorId: 'u1',
      factsheetId: 'fs1',
    });
    expect(id).toBeTruthy();
    const row = db.$client.prepare('SELECT * FROM research_thread_events WHERE id = ?').get(id) as any;
    expect(row.event_type).toBe('factsheet_unmerged');
    expect(row.factsheet_id).toBe('fs1');
    expect(row.reason).toBe('Wrong person');
    expect(row.thread_id).toBeNull();
  });

  it('persists thread_id when provided', async () => {
    db.$client.prepare(`INSERT INTO research_threads (id, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`).run('t1', 'T', 'u', '2026-05-24', '2026-05-24');
    const id = await logReverseEvent({
      db: db as any,
      eventType: 'factsheet_restored',
      reason: 'Brought back',
      actorId: 'u1',
      factsheetId: 'fs1',
      threadId: 't1',
    });
    const row = db.$client.prepare('SELECT thread_id FROM research_thread_events WHERE id = ?').get(id) as any;
    expect(row.thread_id).toBe('t1');
  });

  it('encodes payload_json when provided', async () => {
    const id = await logReverseEvent({
      db: db as any,
      eventType: 'gedcom_disputed',
      reason: 'Conflicting census',
      actorId: 'u1',
      payload: { target: 'families', rowId: 'fam-1' },
    });
    const row = db.$client.prepare('SELECT payload_json FROM research_thread_events WHERE id = ?').get(id) as any;
    expect(JSON.parse(row.payload_json)).toEqual({ target: 'families', rowId: 'fam-1' });
  });

  it('throws when reason is empty', async () => {
    await expect(logReverseEvent({
      db: db as any, eventType: 'hint_reset', reason: '', actorId: 'u1',
    })).rejects.toThrow(/reason is required/);
  });

  it('throws when reason is whitespace-only', async () => {
    await expect(logReverseEvent({
      db: db as any, eventType: 'hint_reset', reason: '   ', actorId: 'u1',
    })).rejects.toThrow(/reason is required/);
  });

  it('trims the reason before persisting', async () => {
    const id = await logReverseEvent({
      db: db as any, eventType: 'fact_unaccepted', reason: '  trimmed  ', actorId: 'u1', researchFactId: 'rf1',
    });
    const row = db.$client.prepare('SELECT reason FROM research_thread_events WHERE id = ?').get(id) as any;
    expect(row.reason).toBe('trimmed');
  });
});
