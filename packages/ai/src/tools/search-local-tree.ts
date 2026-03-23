import { tool } from 'ai';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

interface LocalTreeResult {
  id: string;
  name: string;
  sex: string;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
}

/**
 * Execute a local tree search using FTS5 and/or exact matches.
 * Filters living persons for privacy.
 */
export async function executeSearchLocalTree(
  db: Database,
  params: {
    givenName?: string;
    surname?: string;
    birthYear?: number;
    birthPlace?: string;
    query?: string;
  }
): Promise<LocalTreeResult[]> {
  const { givenName, surname, birthYear, birthPlace, query } = params;

  // Build FTS query terms
  const ftsTerms: string[] = [];
  if (givenName) ftsTerms.push(`given_name:${givenName}*`);
  if (surname) ftsTerms.push(`surname:${surname}*`);
  if (query) ftsTerms.push(query);

  let rows: Array<{
    id: string;
    given_name: string;
    surname: string;
    sex: string;
    is_living: number;
    birth_date: string | null;
    birth_place: string | null;
    death_date: string | null;
    death_place: string | null;
  }>;

  if (ftsTerms.length > 0) {
    const ftsQuery = ftsTerms.join(' ');
    rows = await db.all(sql`
      SELECT
        p.id,
        pn.given_name,
        pn.surname,
        p.sex,
        p.is_living,
        birth_ev.date_original as birth_date,
        birth_ev.place_text as birth_place,
        death_ev.date_original as death_date,
        death_ev.place_text as death_place
      FROM persons_fts fts
      JOIN person_names pn ON pn.rowid = fts.rowid
      JOIN persons p ON p.id = pn.person_id
      LEFT JOIN events birth_ev ON birth_ev.person_id = p.id AND birth_ev.event_type = 'birth'
      LEFT JOIN events death_ev ON death_ev.person_id = p.id AND death_ev.event_type = 'death'
      WHERE persons_fts MATCH ${ftsQuery}
        AND p.deleted_at IS NULL
      LIMIT 10
    `);
  } else if (birthYear || birthPlace) {
    // Fallback to direct query without FTS
    const conditions: string[] = ['p.deleted_at IS NULL'];
    if (birthYear) {
      const yearStart = birthYear * 10000;
      const yearEnd = (birthYear + 1) * 10000;
      conditions.push(`birth_ev.date_sort >= ${yearStart} AND birth_ev.date_sort < ${yearEnd}`);
    }
    if (birthPlace) {
      conditions.push(`birth_ev.place_text LIKE '%${birthPlace.replace(/'/g, "''")}%'`);
    }

    rows = await db.all(sql.raw(`
      SELECT
        p.id,
        pn.given_name,
        pn.surname,
        p.sex,
        p.is_living,
        birth_ev.date_original as birth_date,
        birth_ev.place_text as birth_place,
        death_ev.date_original as death_date,
        death_ev.place_text as death_place
      FROM persons p
      JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
      LEFT JOIN events birth_ev ON birth_ev.person_id = p.id AND birth_ev.event_type = 'birth'
      LEFT JOIN events death_ev ON death_ev.person_id = p.id AND death_ev.event_type = 'death'
      WHERE ${conditions.join(' AND ')}
      LIMIT 10
    `));
  } else {
    return [];
  }

  return rows.map(row => ({
    id: row.id,
    name: row.is_living
      ? 'Living Person'
      : `${row.given_name} ${row.surname}`,
    sex: row.sex,
    birthDate: row.is_living ? null : row.birth_date,
    birthPlace: row.is_living ? null : row.birth_place,
    deathDate: row.is_living ? null : row.death_date,
    deathPlace: row.is_living ? null : row.death_place,
  }));
}

/**
 * Create the searchLocalTree tool bound to a database instance.
 */
export function createSearchLocalTreeTool(db: Database) {
  return tool({
    description: 'Search the local family tree database for persons matching a query',
    parameters: z.object({
      givenName: z.string().optional().describe('Given/first name to search'),
      surname: z.string().optional().describe('Family/last name to search'),
      birthYear: z.number().optional().describe('Approximate birth year'),
      birthPlace: z.string().optional().describe('Birth place to search'),
      query: z.string().optional().describe('Free-text search across all fields'),
    }),
    execute: async (params) => executeSearchLocalTree(db, params),
  });
}
