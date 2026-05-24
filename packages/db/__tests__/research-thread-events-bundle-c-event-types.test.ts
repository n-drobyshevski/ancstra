import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestCentralDb, type TestCentralDb } from '../src/test-fixtures';
import { RESEARCH_THREAD_EVENTS_BOOTSTRAP_SQL } from './fixtures/research-thread-events-bootstrap';

/**
 * Bundle C — Research Flow Factsheet ops (2026-05-24).
 *
 * Validates that the runtime `research_thread_events` table accepts the three
 * new factsheet event_type values. There is no DB-level CHECK on event_type
 * (TS enum is the source of truth — see vocab-consistency.test.ts for the
 * Bundle A pattern) — these inserts succeed at the DB layer regardless, so
 * the test merely guards that the bootstrap shape doesn't grow an accidental
 * CHECK and reject them.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §5
 */

let db: TestCentralDb;

beforeEach(() => {
  db = createTestCentralDb();
  (db.$client as unknown as { ['exec']: (s: string) => void })['exec'](RESEARCH_THREAD_EVENTS_BOOTSTRAP_SQL);
});

afterEach(() => {
  db.$client.close();
});

const BUNDLE_C_TYPES = [
  'factsheet_patched',
  'factsheet_detached',
  'factsheet_force_repromoted',
];

describe('research_thread_events — Bundle C factsheet event types', () => {
  it.each(BUNDLE_C_TYPES)('accepts %s', (eventType) => {
    expect(() => db.$client.prepare(
      `INSERT INTO research_thread_events (id, event_type, actor_id, occurred_at) VALUES (?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), eventType, 'u', '2026-05-24')).not.toThrow();
  });
});
