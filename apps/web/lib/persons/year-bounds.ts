import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

export interface TreeYearBounds {
  minYear: number | null;
  maxYear: number | null;
}

export async function queryTreeYearBounds(db: Database): Promise<TreeYearBounds> {
  const [row] = await db.all<{ min_sort: number | null; max_sort: number | null }>(sql`
    SELECT
      MIN(date_sort) AS min_sort,
      MAX(date_sort) AS max_sort
    FROM events
    WHERE event_type IN ('birth', 'death')
      AND date_sort IS NOT NULL
  `);

  return {
    minYear: row.min_sort != null ? Math.floor(row.min_sort / 10000) : null,
    maxYear: row.max_sort != null ? Math.floor(row.max_sort / 10000) : null,
  };
}
