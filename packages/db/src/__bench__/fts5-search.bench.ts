import { bench, describe } from 'vitest';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../family-schema';
import { generateTree } from './seed-bench';

/** Create the FTS5 virtual table + auto-sync triggers + initial index rebuild. */
function initFts5(sqlite: import('better-sqlite3').Database): void {
  sqlite.prepare(`
    CREATE VIRTUAL TABLE IF NOT EXISTS persons_fts USING fts5(
      given_name, surname,
      content=person_names,
      content_rowid=rowid
    )
  `).run();

  sqlite.prepare(`
    CREATE TRIGGER IF NOT EXISTS persons_fts_ai AFTER INSERT ON person_names BEGIN
      INSERT INTO persons_fts(rowid, given_name, surname)
        VALUES (new.rowid, new.given_name, new.surname);
    END
  `).run();

  sqlite.prepare(`
    CREATE TRIGGER IF NOT EXISTS persons_fts_ad AFTER DELETE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
        VALUES ('delete', old.rowid, old.given_name, old.surname);
    END
  `).run();

  sqlite.prepare(`
    CREATE TRIGGER IF NOT EXISTS persons_fts_au AFTER UPDATE ON person_names BEGIN
      INSERT INTO persons_fts(persons_fts, rowid, given_name, surname)
        VALUES ('delete', old.rowid, old.given_name, old.surname);
      INSERT INTO persons_fts(rowid, given_name, surname)
        VALUES (new.rowid, new.given_name, new.surname);
    END
  `).run();

  // Bulk-populate the FTS index from existing person_names rows
  sqlite.prepare(`INSERT INTO persons_fts(persons_fts) VALUES('rebuild')`).run();
}

for (const scale of [1000, 5000]) {
  describe(`fts5-search @ ${scale} persons`, () => {
    const sqlite = generateTree(scale);
    const db = drizzle(sqlite, { schema }) as any;

    initFts5(sqlite);

    bench('search by prefix (Joh*)', () => {
      db.all(sql`
        SELECT pn.person_id, pn.given_name, pn.surname
        FROM persons_fts
        JOIN person_names pn ON pn.rowid = persons_fts.rowid
        WHERE persons_fts MATCH 'Joh*'
        ORDER BY rank
        LIMIT 50
      `);
    });

    bench('search by full name (John* Smith*)', () => {
      db.all(sql`
        SELECT pn.person_id, pn.given_name, pn.surname
        FROM persons_fts
        JOIN person_names pn ON pn.rowid = persons_fts.rowid
        WHERE persons_fts MATCH 'John* Smith*'
        ORDER BY rank
        LIMIT 50
      `);
    });
  });
}
