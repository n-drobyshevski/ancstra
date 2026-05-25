/**
 * Integration test for getProposedRelationshipsForTree (Bundle A T4.5 deferred).
 *
 * The query was rewired from the retired proposed_relationships table to
 * factsheets + research_facts: a "proposal" is now a draft factsheet
 * (entity_type='family_unit', status='draft') with at least one research_fact
 * carrying extractionMethod='ai_extracted' and fact_type in
 * (parent_name | spouse_name | sibling_name). This test pins the exclusion
 * filters so a regression would be caught.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '@ancstra/db/schema';
import { getProposedRelationshipsForTree } from '../lib/queries';

const NOW = '2026-05-23T10:00:00.000Z';

function createTestDb(): any {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE persons (id TEXT PRIMARY KEY, sex TEXT NOT NULL DEFAULT 'U', is_living INTEGER NOT NULL DEFAULT 1, privacy_level TEXT NOT NULL DEFAULT 'private', notes TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE factsheets (id TEXT PRIMARY KEY, title TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT 'person', status TEXT NOT NULL DEFAULT 'draft', notes TEXT, promoted_person_id TEXT, promoted_at TEXT, cluster_promotion_id TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE research_facts (id TEXT PRIMARY KEY, person_id TEXT NOT NULL, fact_type TEXT NOT NULL, fact_value TEXT NOT NULL, fact_date_sort INTEGER, research_item_id TEXT, source_citation_id TEXT, confidence TEXT NOT NULL DEFAULT 'medium', extraction_method TEXT NOT NULL DEFAULT 'manual', factsheet_id TEXT, accepted INTEGER, contested INTEGER NOT NULL DEFAULT 0, provenance TEXT NOT NULL DEFAULT 'derived', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);
  return drizzle(sqlite, { schema }) as any;
}

let db: any;

function p(id: string) {
  db.run(sql`INSERT INTO persons (id, sex, is_living, privacy_level, created_at, updated_at) VALUES (${id}, 'U', 1, 'private', ${NOW}, ${NOW})`);
}
function fs(
  id: string,
  opts: { entityType?: string; status?: string } = {},
) {
  db.run(sql`
    INSERT INTO factsheets (id, title, entity_type, status, created_by, created_at, updated_at)
    VALUES (${id}, ${'title ' + id}, ${opts.entityType ?? 'family_unit'}, ${opts.status ?? 'draft'}, 'u1', ${NOW}, ${NOW})
  `);
}
function fact(
  id: string,
  factsheetId: string,
  personId: string,
  factValue: string,
  opts: {
    factType?: 'parent_name' | 'spouse_name' | 'sibling_name';
    extractionMethod?: 'manual' | 'ai_extracted' | 'ocr_extracted';
    confidence?: 'high' | 'medium' | 'low' | 'unknown';
  } = {},
) {
  db.run(sql`
    INSERT INTO research_facts (id, factsheet_id, person_id, fact_type, fact_value, confidence, extraction_method, provenance, created_at, updated_at)
    VALUES (${id}, ${factsheetId}, ${personId}, ${opts.factType ?? 'parent_name'}, ${factValue}, ${opts.confidence ?? 'medium'}, ${opts.extractionMethod ?? 'ai_extracted'}, 'derived', ${NOW}, ${NOW})
  `);
}

beforeEach(() => {
  db = createTestDb();
});

describe('getProposedRelationshipsForTree', () => {
  it('returns empty array when no factsheets exist', async () => {
    const rows = await getProposedRelationshipsForTree(db);
    expect(rows).toEqual([]);
  });

  it('returns one row for a draft family_unit factsheet with an ai_extracted parent_name fact', async () => {
    p('p1');
    p('p2');
    fs('fs1', { entityType: 'family_unit', status: 'draft' });
    fact('rf1', 'fs1', 'p1', 'p2', { factType: 'parent_name', extractionMethod: 'ai_extracted', confidence: 'medium' });

    const rows = await getProposedRelationshipsForTree(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: 'fs1',
      person1Id: 'p1',
      person2Id: 'p2',
      relationshipType: 'parent_child',
      sourceType: 'ai_suggestion',
      confidence: 0.70,
    });
  });

  it('maps fact_type to relationshipType correctly (parent_name=parent_child, sibling_name=sibling, spouse_name=partner)', async () => {
    p('p1');
    p('p2');
    p('p3');
    p('p4');
    fs('fs1');
    fs('fs2');
    fs('fs3');
    fact('rf1', 'fs1', 'p1', 'p2', { factType: 'parent_name' });
    fact('rf2', 'fs2', 'p1', 'p3', { factType: 'sibling_name' });
    fact('rf3', 'fs3', 'p1', 'p4', { factType: 'spouse_name' });

    const rows = await getProposedRelationshipsForTree(db);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('fs1')?.relationshipType).toBe('parent_child');
    expect(byId.get('fs2')?.relationshipType).toBe('sibling');
    // spec section 3.1: 'spouse_name' fact maps to 'partner' (3-value AI enum default).
    expect(byId.get('fs3')?.relationshipType).toBe('partner');
  });

  it('maps confidence band to numeric (high=0.925, medium=0.70, low=0.375, unknown=null)', async () => {
    p('p1');
    p('p2');
    p('p3');
    p('p4');
    p('p5');
    fs('fs-hi');
    fs('fs-md');
    fs('fs-lo');
    fs('fs-un');
    fact('rf-hi', 'fs-hi', 'p1', 'p2', { confidence: 'high' });
    fact('rf-md', 'fs-md', 'p1', 'p3', { confidence: 'medium' });
    fact('rf-lo', 'fs-lo', 'p1', 'p4', { confidence: 'low' });
    fact('rf-un', 'fs-un', 'p1', 'p5', { confidence: 'unknown' });

    const rows = await getProposedRelationshipsForTree(db);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('fs-hi')?.confidence).toBe(0.925);
    expect(byId.get('fs-md')?.confidence).toBe(0.70);
    expect(byId.get('fs-lo')?.confidence).toBe(0.375);
    expect(byId.get('fs-un')?.confidence).toBeNull();
  });

  it('excludes factsheets with status != draft', async () => {
    p('p1');
    p('p2');
    fs('fs1', { entityType: 'family_unit', status: 'ready' });
    fact('rf1', 'fs1', 'p1', 'p2', { extractionMethod: 'ai_extracted' });

    const rows = await getProposedRelationshipsForTree(db);
    expect(rows).toHaveLength(0);
  });

  it('excludes factsheets with entity_type != family_unit', async () => {
    p('p1');
    p('p2');
    fs('fs1', { entityType: 'person', status: 'draft' });
    fact('rf1', 'fs1', 'p1', 'p2', { extractionMethod: 'ai_extracted' });

    const rows = await getProposedRelationshipsForTree(db);
    expect(rows).toHaveLength(0);
  });

  it('excludes research_facts with extraction_method != ai_extracted', async () => {
    p('p1');
    p('p2');
    fs('fs1', { entityType: 'family_unit', status: 'draft' });
    fact('rf1', 'fs1', 'p1', 'p2', { extractionMethod: 'manual' });

    const rows = await getProposedRelationshipsForTree(db);
    expect(rows).toHaveLength(0);
  });

  it('excludes facts whose fact_value points to a soft-deleted person', async () => {
    p('p1');
    p('p2');
    db.run(sql`UPDATE persons SET deleted_at = ${NOW} WHERE id = 'p2'`);
    fs('fs1');
    fact('rf1', 'fs1', 'p1', 'p2', { extractionMethod: 'ai_extracted' });

    const rows = await getProposedRelationshipsForTree(db);
    expect(rows).toHaveLength(0);
  });

  it('excludes facts whose person_id points to a soft-deleted person', async () => {
    p('p1');
    p('p2');
    db.run(sql`UPDATE persons SET deleted_at = ${NOW} WHERE id = 'p1'`);
    fs('fs1');
    fact('rf1', 'fs1', 'p1', 'p2', { extractionMethod: 'ai_extracted' });

    const rows = await getProposedRelationshipsForTree(db);
    expect(rows).toHaveLength(0);
  });
});
