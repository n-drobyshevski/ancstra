import { tool } from 'ai';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

interface GapEntry {
  personName: string;
  personId: string;
  gapType: 'missing_birth_date' | 'missing_death_date' | 'missing_parents' | 'missing_sources';
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
}

/**
 * Execute the tree gaps analysis.
 */
export async function executeAnalyzeTreeGaps(
  db: Database,
  personId?: string,
  maxGenerations = 5
): Promise<GapEntry[]> {
  // If a personId is given, walk ancestors. Otherwise, analyze entire tree.
  let personIds: string[];

  if (personId) {
    const ancestorRows = db.all<{ id: string }>(sql`
      WITH RECURSIVE anc AS (
        SELECT p.id, 0 as gen
        FROM persons p WHERE p.id = ${personId} AND p.deleted_at IS NULL
        UNION ALL
        SELECT parent.id, anc.gen + 1
        FROM anc
        JOIN children c ON c.person_id = anc.id
        JOIN families f ON f.id = c.family_id
        JOIN persons parent ON (parent.id = f.partner1_id OR parent.id = f.partner2_id)
          AND parent.id != anc.id
        WHERE parent.deleted_at IS NULL AND anc.gen < ${maxGenerations}
      )
      SELECT id FROM anc
    `);
    personIds = ancestorRows.map(r => r.id);
  } else {
    const allRows = db.all<{ id: string }>(sql`
      SELECT id FROM persons WHERE deleted_at IS NULL LIMIT 200
    `);
    personIds = allRows.map(r => r.id);
  }

  if (personIds.length === 0) return [];

  const gaps: GapEntry[] = [];

  // Check each person for gaps
  for (const pid of personIds) {
    const nameRows = db.all<{ given_name: string; surname: string }>(sql`
      SELECT given_name, surname FROM person_names
      WHERE person_id = ${pid} AND is_primary = 1
      LIMIT 1
    `);
    if (nameRows.length === 0) continue;
    const personName = `${nameRows[0].given_name} ${nameRows[0].surname}`;

    // Missing birth date
    const birthRows = db.all<{ cnt: number }>(sql`
      SELECT COUNT(*) as cnt FROM events
      WHERE person_id = ${pid} AND event_type = 'birth' AND date_sort IS NOT NULL
    `);
    if ((birthRows[0]?.cnt ?? 0) === 0) {
      gaps.push({
        personName,
        personId: pid,
        gapType: 'missing_birth_date',
        priority: 'high',
        suggestion: `Search vital records for birth date of ${personName}`,
      });
    }

    // Missing death date (only for non-living persons)
    const personRows = db.all<{ is_living: number }>(sql`
      SELECT is_living FROM persons WHERE id = ${pid}
    `);
    if (personRows[0] && !personRows[0].is_living) {
      const deathRows = db.all<{ cnt: number }>(sql`
        SELECT COUNT(*) as cnt FROM events
        WHERE person_id = ${pid} AND event_type = 'death' AND date_sort IS NOT NULL
      `);
      if ((deathRows[0]?.cnt ?? 0) === 0) {
        gaps.push({
          personName,
          personId: pid,
          gapType: 'missing_death_date',
          priority: 'medium',
          suggestion: `Search death records, cemetery records, or obituaries for ${personName}`,
        });
      }
    }

    // Missing parents
    const parentRows = db.all<{ cnt: number }>(sql`
      SELECT COUNT(*) as cnt FROM children WHERE person_id = ${pid}
    `);
    if ((parentRows[0]?.cnt ?? 0) === 0) {
      gaps.push({
        personName,
        personId: pid,
        gapType: 'missing_parents',
        priority: 'high',
        suggestion: `Search census, birth, and church records for parents of ${personName}`,
      });
    }

    // Missing source citations
    const sourceRows = db.all<{ cnt: number }>(sql`
      SELECT COUNT(*) as cnt FROM source_citations WHERE person_id = ${pid}
    `);
    if ((sourceRows[0]?.cnt ?? 0) === 0) {
      gaps.push({
        personName,
        personId: pid,
        gapType: 'missing_sources',
        priority: 'low',
        suggestion: `Add source citations for ${personName} to strengthen evidence`,
      });
    }
  }

  // Sort by priority (high first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return gaps;
}

/**
 * Create the analyzeTreeGaps tool bound to a database instance.
 */
export function createAnalyzeTreeGapsTool(db: Database) {
  return tool({
    description: 'Analyze the family tree for research gaps and suggest priorities',
    parameters: z.object({
      personId: z.string().optional().describe('Focus on a specific person\'s line'),
      maxGenerations: z.number().default(5).describe('How many generations to analyze'),
    }),
    execute: async ({ personId, maxGenerations }) =>
      executeAnalyzeTreeGaps(db, personId, maxGenerations),
  });
}
