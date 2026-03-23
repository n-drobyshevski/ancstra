import { bench, describe } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../family-schema';
import { rebuildClosureTable } from '../closure-table';
import { generateTree } from './seed-bench';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Return the id of the person whose rowid sits roughly in the middle. */
function midPersonId(db: ReturnType<typeof drizzle>): string {
  const rows = db.all<{ id: string }>(sql`
    SELECT id FROM persons ORDER BY rowid
    LIMIT 1 OFFSET (SELECT COUNT(*)/2 FROM persons)
  `);
  return rows[0]?.id ?? '';
}

// ─── benchmarks ─────────────────────────────────────────────────────────────

for (const scale of [100, 500, 1000, 5000]) {
  describe(`closure-table @ ${scale} persons`, () => {
    // Set up once per describe block — vitest bench shares module scope
    const sqlite = generateTree(scale);
    const db = drizzle(sqlite, { schema }) as any;

    // Rebuild closure table once before benching queries
    let ready = false;
    function ensureReady() {
      if (ready) return;
      ready = true;
      // rebuildClosureTable is async but uses sync better-sqlite3 under the hood
      void rebuildClosureTable(db);
    }

    const personId = (() => {
      ensureReady();
      return midPersonId(db);
    })();

    bench('find all ancestors (closure table)', () => {
      ensureReady();
      db.all(sql`
        SELECT ancestor_id, depth
        FROM ancestor_paths
        WHERE descendant_id = ${personId}
        ORDER BY depth
      `);
    });

    bench('find all descendants (closure table)', () => {
      ensureReady();
      db.all(sql`
        SELECT descendant_id, depth
        FROM ancestor_paths
        WHERE ancestor_id = ${personId}
        ORDER BY depth
      `);
    });

    bench('find all ancestors (recursive CTE)', () => {
      db.all(sql`
        WITH RECURSIVE ancestors(person_id, depth) AS (
          SELECT c.person_id, 1
          FROM children c
          JOIN families f ON f.id = c.family_id
          WHERE f.partner1_id = ${personId} OR f.partner2_id = ${personId}
          UNION ALL
          SELECT c2.person_id, a.depth + 1
          FROM ancestors a
          JOIN families f2 ON f2.partner1_id = a.person_id OR f2.partner2_id = a.person_id
          JOIN children c2 ON c2.family_id = f2.id
        )
        SELECT person_id, depth FROM ancestors
      `);
    });
  });
}
