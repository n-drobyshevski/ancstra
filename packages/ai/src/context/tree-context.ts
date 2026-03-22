import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

export interface PersonSummary {
  id: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  birthPlace: string | null;
  generation: number;
}

export interface TreeContext {
  summary: string;
  keyPersons: PersonSummary[];
  gaps: string[];
  recentActivity: string[];
  tokenBudget: number;
}

interface TreeStats {
  personCount: number;
  generationCount: number;
  earliestAncestor: { name: string; birthYear: number | null } | null;
  sourcedPercentage: number;
}

interface RawPersonRow {
  id: string;
  given_name: string;
  surname: string;
  birth_date_sort: number | null;
  death_date_sort: number | null;
  birth_place: string | null;
  generation: number;
}

/**
 * Get basic stats about the tree: person count, generation count, earliest ancestor.
 */
async function getTreeStats(db: Database): Promise<TreeStats> {
  const countRows = db.all<{ cnt: number }>(
    sql`SELECT COUNT(*) as cnt FROM persons WHERE deleted_at IS NULL`
  );
  const personCount = countRows[0]?.cnt ?? 0;

  // Find earliest ancestor by birth date
  const earliestRows = db.all<{ given_name: string; surname: string; birth_date_sort: number | null }>(sql`
    SELECT pn.given_name, pn.surname, e.date_sort as birth_date_sort
    FROM persons p
    JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    LEFT JOIN events e ON e.person_id = p.id AND e.event_type = 'birth'
    WHERE p.deleted_at IS NULL AND e.date_sort IS NOT NULL
    ORDER BY e.date_sort ASC
    LIMIT 1
  `);

  const earliest = earliestRows[0] ?? null;
  const earliestAncestor = earliest
    ? {
        name: `${earliest.given_name} ${earliest.surname}`,
        birthYear: earliest.birth_date_sort ? Math.floor(earliest.birth_date_sort / 10000) : null,
      }
    : null;

  // Count sourced persons (persons with at least one source citation)
  const sourcedRows = db.all<{ cnt: number }>(sql`
    SELECT COUNT(DISTINCT sc.person_id) as cnt
    FROM source_citations sc
    WHERE sc.person_id IS NOT NULL
  `);
  const sourcedCount = sourcedRows[0]?.cnt ?? 0;
  const sourcedPercentage = personCount > 0 ? Math.round((sourcedCount / personCount) * 100) : 0;

  // Estimate generation count from ancestor depth
  const genRows = db.all<{ max_gen: number }>(sql`
    WITH RECURSIVE ancestor_tree AS (
      SELECT p.id, 0 as gen
      FROM persons p
      WHERE p.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM children c
          JOIN families f ON f.id = c.family_id
          WHERE c.person_id = p.id
        )
      UNION ALL
      SELECT c.person_id, at.gen + 1
      FROM ancestor_tree at
      JOIN families f ON (f.partner1_id = at.id OR f.partner2_id = at.id)
      JOIN children c ON c.family_id = f.id
      WHERE at.gen < 20
    )
    SELECT MAX(gen) as max_gen FROM ancestor_tree
  `);
  const generationCount = (genRows[0]?.max_gen ?? 0) + 1;

  return { personCount, generationCount, earliestAncestor, sourcedPercentage };
}

/**
 * Find the root person (someone with no parents) or return focusPersonId.
 */
async function findRootPerson(db: Database): Promise<string | null> {
  const rows = db.all<{ id: string }>(sql`
    SELECT p.id
    FROM persons p
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM children c WHERE c.person_id = p.id
      )
    LIMIT 1
  `);
  return rows[0]?.id ?? null;
}

/**
 * Get ancestor line from a person up to maxGenerations.
 */
async function getAncestors(db: Database, personId: string, maxGenerations: number): Promise<RawPersonRow[]> {
  const rows = db.all<RawPersonRow>(sql`
    WITH RECURSIVE ancestor_tree AS (
      SELECT p.id, 0 as generation
      FROM persons p
      WHERE p.id = ${personId} AND p.deleted_at IS NULL
      UNION ALL
      SELECT parent.id, at.generation + 1
      FROM ancestor_tree at
      JOIN children c ON c.person_id = at.id
      JOIN families f ON f.id = c.family_id
      JOIN persons parent ON (parent.id = f.partner1_id OR parent.id = f.partner2_id)
      WHERE parent.deleted_at IS NULL AND at.generation < ${maxGenerations}
    )
    SELECT
      at.id,
      pn.given_name,
      pn.surname,
      birth_ev.date_sort as birth_date_sort,
      death_ev.date_sort as death_date_sort,
      birth_ev.place_text as birth_place,
      at.generation
    FROM ancestor_tree at
    JOIN person_names pn ON pn.person_id = at.id AND pn.is_primary = 1
    LEFT JOIN events birth_ev ON birth_ev.person_id = at.id AND birth_ev.event_type = 'birth'
    LEFT JOIN events death_ev ON death_ev.person_id = at.id AND death_ev.event_type = 'death'
    ORDER BY at.generation ASC
  `);
  return rows;
}

/**
 * Identify research gaps: missing dates, parents, sources.
 */
async function identifyResearchGaps(db: Database): Promise<string[]> {
  const gaps: string[] = [];

  // Missing birth dates
  const missingBirth = db.all<{ given_name: string; surname: string }>(sql`
    SELECT pn.given_name, pn.surname
    FROM persons p
    JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM events e WHERE e.person_id = p.id AND e.event_type = 'birth' AND e.date_sort IS NOT NULL
      )
    LIMIT 5
  `);
  for (const p of missingBirth) {
    gaps.push(`Missing birth date: ${p.given_name} ${p.surname}`);
  }

  // Missing parents (no family as child)
  const missingParents = db.all<{ given_name: string; surname: string }>(sql`
    SELECT pn.given_name, pn.surname
    FROM persons p
    JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM children c WHERE c.person_id = p.id
      )
    LIMIT 5
  `);
  for (const p of missingParents) {
    gaps.push(`Missing parents: ${p.given_name} ${p.surname}`);
  }

  return gaps.slice(0, 10);
}

/**
 * Get recent activity: last 5 persons created or updated.
 */
async function getRecentActivity(db: Database): Promise<string[]> {
  const rows = db.all<{ given_name: string; surname: string; updated_at: string }>(sql`
    SELECT pn.given_name, pn.surname, p.updated_at
    FROM persons p
    JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    WHERE p.deleted_at IS NULL
    ORDER BY p.updated_at DESC
    LIMIT 5
  `);
  return rows.map(r => `Updated ${r.given_name} ${r.surname} (${r.updated_at})`);
}

/**
 * Build a tree context for the AI system prompt.
 *
 * @param db - Drizzle database instance
 * @param focusPersonId - Optional person to focus the context on
 * @param tokenBudget - Approximate token budget for context (default 2000)
 */
export async function buildTreeContext(
  db: Database,
  focusPersonId?: string,
  tokenBudget = 2000
): Promise<TreeContext> {
  const stats = await getTreeStats(db);

  // Build summary
  let summary = `Family tree with ${stats.personCount} persons`;
  if (stats.generationCount > 1) {
    summary += ` spanning ${stats.generationCount} generations`;
  }
  if (stats.earliestAncestor) {
    summary += `. Earliest ancestor: ${stats.earliestAncestor.name}`;
    if (stats.earliestAncestor.birthYear) {
      summary += ` (${stats.earliestAncestor.birthYear})`;
    }
  }
  summary += `. ${stats.sourcedPercentage}% of persons are sourced.`;

  // Get key persons from direct line
  const rootId = focusPersonId || await findRootPerson(db);
  let keyPersons: PersonSummary[] = [];

  if (rootId) {
    const ancestors = await getAncestors(db, rootId, 5);
    // Estimate ~40 tokens per person; cap based on budget
    const maxPersons = Math.min(50, Math.max(5, Math.floor(tokenBudget / 40)));
    keyPersons = ancestors.slice(0, maxPersons).map(row => ({
      id: row.id,
      name: `${row.given_name} ${row.surname}`,
      birthYear: row.birth_date_sort ? Math.floor(row.birth_date_sort / 10000) : null,
      deathYear: row.death_date_sort ? Math.floor(row.death_date_sort / 10000) : null,
      birthPlace: row.birth_place,
      generation: row.generation,
    }));
  }

  // Identify gaps
  const gaps = await identifyResearchGaps(db);

  // Recent activity
  const recentActivity = await getRecentActivity(db);

  return { summary, keyPersons, gaps, recentActivity, tokenBudget };
}
