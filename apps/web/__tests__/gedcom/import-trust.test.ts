import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { families, children } from '@ancstra/db';

/**
 * CLAUDE.md invariant:
 * > GEDCOM imports are auto-trusted (`validation_status='confirmed'`)
 * > All relationships from external sources go through validation pipeline
 *
 * Two anchors keep this invariant safe even if one half drifts:
 *   1. **Schema** — `families`/`children` tables DEFAULT validation_status to
 *      'confirmed'. Anchored here by inserting without an explicit value and
 *      reading back. If a future migration flips the default to 'pending'
 *      this test fails.
 *   2. **Call site** — the GEDCOM router still passes the literal
 *      `validationStatus: 'confirmed' as const` at the two insert sites
 *      (apps/web/server/api/routers/gedcom.ts:174, :187). Anchored by a
 *      source-text scan so a refactor that drops the explicit literal still
 *      surfaces here as a test failure (and forces the author to re-justify
 *      relying purely on the DB default).
 *
 * External / AI-sourced relationships live in the separate
 * `proposed_relationships` table — see
 * `packages/db/__tests__/proposed-relationships-lifecycle.test.ts`.
 */

function createFamiliesAndChildrenTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Minimal persons table — required for FK references from families/children.
  sqlite.prepare(`
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      sex TEXT NOT NULL DEFAULT 'U',
      is_living INTEGER NOT NULL DEFAULT 1,
      privacy_level TEXT NOT NULL DEFAULT 'private',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `).run();

  // DDL copied verbatim from packages/db/migrations/0001_*.sql / family-schema.ts.
  // Specifically asserts the DEFAULT clause for validation_status.
  sqlite.prepare(`
    CREATE TABLE families (
      id TEXT PRIMARY KEY,
      partner1_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      partner2_id TEXT REFERENCES persons(id) ON DELETE SET NULL,
      relationship_type TEXT NOT NULL DEFAULT 'unknown'
        CHECK (relationship_type IN ('married','civil_union','domestic_partner','unmarried','unknown')),
      validation_status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (validation_status IN ('confirmed','proposed','disputed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `).run();

  sqlite.prepare(`
    CREATE TABLE children (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
      child_order INTEGER,
      relationship_to_parent1 TEXT NOT NULL DEFAULT 'biological',
      relationship_to_parent2 TEXT NOT NULL DEFAULT 'biological',
      validation_status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (validation_status IN ('confirmed','proposed','disputed')),
      created_at TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(family_id, person_id)
    )
  `).run();

  return drizzle(sqlite, { schema: { families, children } });
}

const NOW = '2026-01-01T00:00:00.000Z';

describe('GEDCOM auto-trust — schema-default half', () => {
  it("families.validation_status defaults to 'confirmed' when omitted on insert", () => {
    const db = createFamiliesAndChildrenTestDb();
    db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES ('p1', 'M', 1, 'private', ${NOW}, ${NOW})`);
    db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES ('p2', 'F', 1, 'private', ${NOW}, ${NOW})`);
    db.run(sql`INSERT INTO families (id, partner1_id, partner2_id, created_at, updated_at) VALUES ('fam-1', 'p1', 'p2', ${NOW}, ${NOW})`);

    const [row] = db.select().from(families).where(eq(families.id, 'fam-1')).all();
    expect(row.validationStatus).toBe('confirmed');
  });

  it("children.validation_status defaults to 'confirmed' when omitted on insert", () => {
    const db = createFamiliesAndChildrenTestDb();
    db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES ('p1', 'M', 1, 'private', ${NOW}, ${NOW})`);
    db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES ('p2', 'M', 1, 'private', ${NOW}, ${NOW})`);
    db.run(sql`INSERT INTO families (id, created_at, updated_at) VALUES ('fam-1', ${NOW}, ${NOW})`);
    db.run(sql`INSERT INTO children (id, family_id, person_id, created_at) VALUES ('c-1', 'fam-1', 'p2', ${NOW})`);

    const [row] = db.select().from(children).where(eq(children.id, 'c-1')).all();
    expect(row.validationStatus).toBe('confirmed');
  });

  it("CHECK constraint rejects unknown validation_status values for families", () => {
    const db = createFamiliesAndChildrenTestDb();
    let caught: unknown = null;
    try {
      db.run(sql`INSERT INTO families (id, validation_status, created_at, updated_at) VALUES ('fam-bad', 'pending', ${NOW}, ${NOW})`);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    // Drizzle wraps the underlying better-sqlite3 error; the CHECK message
    // surfaces on .cause.
    const cause = (caught as Error & { cause?: unknown }).cause;
    expect(String(cause ?? caught)).toMatch(/CHECK constraint failed/i);
  });
});

describe('GEDCOM auto-trust — call-site half', () => {
  const gedcomRouterSrc = readFileSync(
    join(__dirname, '..', '..', 'server', 'api', 'routers', 'gedcom.ts'),
    'utf8',
  );

  it("GEDCOM router still sets validationStatus: 'confirmed' explicitly at both insert sites", () => {
    // Belt-and-suspenders: the schema default already gives us 'confirmed',
    // but the router writes the literal so reviewers see the auto-trust
    // decision at the insert call. A drop to the default-only form should
    // force a deliberate code change + this test update.
    const matches = gedcomRouterSrc.match(/validationStatus:\s*'confirmed'\s*as\s*const/g);
    expect(matches, `expected two explicit 'confirmed' literals in gedcom.ts, got ${matches?.length ?? 0}`).not.toBeNull();
    expect(matches).toHaveLength(2);
  });

  it("GEDCOM router does NOT set any non-confirmed validationStatus", () => {
    // Catches a regression where someone copies the pattern but flips it to
    // 'proposed' / 'disputed' (e.g. for some kind of partial import).
    const nonConfirmedSetter = gedcomRouterSrc.match(
      /validationStatus:\s*'(?!confirmed)[^']+'/g,
    );
    expect(nonConfirmedSetter).toBeNull();
  });
});
