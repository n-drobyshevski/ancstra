import { bench, describe } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../family-schema';
import { rebuildAllSummaries } from '../person-summary';
import { generateTree } from './seed-bench';

for (const scale of [100, 500, 1000, 5000]) {
  describe(`person-summary @ ${scale} persons`, () => {
    const sqlite = generateTree(scale);
    const db = drizzle(sqlite, { schema }) as any;

    let ready = false;
    function ensureReady() {
      if (ready) return;
      ready = true;
      void rebuildAllSummaries(db);
    }
    ensureReady();

    bench('load tree data (person_summary)', () => {
      ensureReady();
      db.all(sql`
        SELECT person_id, given_name, surname, sex, is_living,
               birth_date, death_date, birth_date_sort, death_date_sort,
               birth_place, death_place, spouse_count, child_count, parent_count
        FROM person_summary
      `);
    });

    bench('load tree data (JOINs)', () => {
      db.all(sql`
        SELECT p.id, p.sex, p.is_living,
               pn.given_name, pn.surname,
               eb.date_original AS birth_date, eb.date_sort AS birth_date_sort,
               ed.date_original AS death_date, ed.date_sort AS death_date_sort
        FROM persons p
        LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
        LEFT JOIN events eb ON eb.person_id = p.id AND eb.event_type = 'birth'
        LEFT JOIN events ed ON ed.person_id = p.id AND ed.event_type = 'death'
        WHERE p.deleted_at IS NULL
      `);
    });
  });
}
