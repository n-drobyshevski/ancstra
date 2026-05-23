import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';

/**
 * Bundle A — Research Flow Unification (2026-05-23).
 *
 * Validates the renamed `research_items.status` lifecycle vocabulary:
 *  - Default is now 'collected' (was 'draft')
 *  - All four new values are accepted: collected / processed / extracted / discarded
 *  - Backfill UPDATE statements correctly remap legacy strings
 */

const BOOTSTRAP_SQL = `
  CREATE TABLE research_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_by TEXT NOT NULL,
    discovery_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'collected',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

const insert = (id: string, status: string) =>
  db.$client
    .prepare(
      `INSERT INTO research_items (id, title, created_by, discovery_method, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, 't', 'u', 'paste_text', status, '2026-05-23', '2026-05-23');

const getStatus = (id: string) =>
  (
    db.$client.prepare('SELECT status FROM research_items WHERE id = ?').get(id) as {
      status: string;
    }
  ).status;

describe('research_items.status — Bundle A vocab contract', () => {
  it('defaults to collected', () => {
    db.$client
      .prepare(
        `INSERT INTO research_items (id, title, created_by, discovery_method, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run('r1', 't', 'u', 'paste_text', '2026-05-23', '2026-05-23');
    expect(getStatus('r1')).toBe('collected');
  });

  it('accepts all four new status values', () => {
    insert('r2', 'collected');
    insert('r3', 'processed');
    insert('r4', 'extracted');
    insert('r5', 'discarded');
    expect(getStatus('r2')).toBe('collected');
    expect(getStatus('r3')).toBe('processed');
    expect(getStatus('r4')).toBe('extracted');
    expect(getStatus('r5')).toBe('discarded');
  });

  it('backfill UPDATEs remap legacy strings', () => {
    insert('r6', 'draft');
    insert('r7', 'ready');
    insert('r8', 'promoted');
    insert('r9', 'merged');
    insert('r10', 'dismissed');

    db.$client.prepare(`UPDATE research_items SET status = 'collected' WHERE status = 'draft'`).run();
    db.$client.prepare(`UPDATE research_items SET status = 'processed' WHERE status = 'ready'`).run();
    db.$client
      .prepare(`UPDATE research_items SET status = 'extracted' WHERE status IN ('promoted', 'merged')`)
      .run();
    db.$client.prepare(`UPDATE research_items SET status = 'discarded' WHERE status = 'dismissed'`).run();

    expect(getStatus('r6')).toBe('collected');
    expect(getStatus('r7')).toBe('processed');
    expect(getStatus('r8')).toBe('extracted');
    expect(getStatus('r9')).toBe('extracted');
    expect(getStatus('r10')).toBe('discarded');
  });
});
