import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { queryTreeYearBounds } from '../../lib/persons/year-bounds';

let db: any;

beforeEach(() => {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, date_original TEXT, date_sort INTEGER, date_modifier TEXT DEFAULT 'exact', date_end_sort INTEGER, place_text TEXT, description TEXT, person_id TEXT, family_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
  `);
  db = drizzle(sqlite, { schema }) as any;
});

const NOW = '2026-01-01T00:00:00.000Z';

function ev(id: string, type: string, dateSort: number | null) {
  db.run(sql`INSERT INTO events (id, event_type, date_sort, person_id, created_at, updated_at) VALUES (${id}, ${type}, ${dateSort}, 'p1', ${NOW}, ${NOW})`);
}

describe('queryTreeYearBounds', () => {
  it('returns nulls when no events', async () => {
    const r = await queryTreeYearBounds(db);
    expect(r).toEqual({ minYear: null, maxYear: null });
  });

  it('returns bounds extracted from date_sort', async () => {
    ev('e1', 'birth', 18200615);
    ev('e2', 'death', 19451130);
    ev('e3', 'birth', 19500101);
    const r = await queryTreeYearBounds(db);
    expect(r).toEqual({ minYear: 1820, maxYear: 1950 });
  });

  it('ignores events with null date_sort', async () => {
    ev('e1', 'birth', 19000101);
    ev('e2', 'birth', null);
    ev('e3', 'death', 19500101);
    const r = await queryTreeYearBounds(db);
    expect(r).toEqual({ minYear: 1900, maxYear: 1950 });
  });

  it('only considers birth and death events', async () => {
    ev('e1', 'birth', 19000101);
    ev('e2', 'baptism', 14000101);
    ev('e3', 'death', 19500101);
    const r = await queryTreeYearBounds(db);
    expect(r).toEqual({ minYear: 1900, maxYear: 1950 });
  });
});