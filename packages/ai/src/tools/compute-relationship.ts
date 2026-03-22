import { tool } from 'ai';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';

interface RelationshipResult {
  relationship: string;
  path: string[];
  commonAncestor: { id: string; name: string } | null;
  generationsRemoved: number;
}

/**
 * Compute the relationship label from generation counts.
 */
function getRelationshipLabel(gen1: number, gen2: number): string {
  if (gen1 === 0 && gen2 === 0) return 'same person';
  if (gen1 === 0 && gen2 === 1) return 'parent';
  if (gen1 === 1 && gen2 === 0) return 'child';
  if (gen1 === 0 && gen2 === 2) return 'grandparent';
  if (gen1 === 2 && gen2 === 0) return 'grandchild';
  if (gen1 === 0 && gen2 === 3) return 'great-grandparent';
  if (gen1 === 3 && gen2 === 0) return 'great-grandchild';
  if (gen1 === 1 && gen2 === 1) return 'sibling';
  if (gen1 === 0 && gen2 > 3) return `${'great-'.repeat(gen2 - 2)}grandparent`;
  if (gen1 > 3 && gen2 === 0) return `${'great-'.repeat(gen1 - 2)}grandchild`;
  if (gen1 === 1 && gen2 > 1) return gen2 === 2 ? 'uncle/aunt' : `great-${'great-'.repeat(gen2 - 3)}uncle/aunt`;
  if (gen1 > 1 && gen2 === 1) return gen1 === 2 ? 'nephew/niece' : `great-${'great-'.repeat(gen1 - 3)}nephew/niece`;

  // Cousins
  const cousinDegree = Math.min(gen1, gen2) - 1;
  const removed = Math.abs(gen1 - gen2);

  const ordinal = cousinDegree === 1 ? '1st' : cousinDegree === 2 ? '2nd' : cousinDegree === 3 ? '3rd' : `${cousinDegree}th`;

  if (removed === 0) return `${ordinal} cousin`;
  return `${ordinal} cousin ${removed}x removed`;
}

/**
 * Execute the relationship computation between two persons.
 */
export async function executeComputeRelationship(
  db: Database,
  person1Id: string,
  person2Id: string
): Promise<RelationshipResult> {
  // Find all ancestors of person1 with generations
  const ancestors1 = db.all<{ id: string; generation: number; given_name: string; surname: string }>(sql`
    WITH RECURSIVE anc AS (
      SELECT p.id, 0 as generation
      FROM persons p WHERE p.id = ${person1Id} AND p.deleted_at IS NULL
      UNION ALL
      SELECT parent.id, anc.generation + 1
      FROM anc
      JOIN children c ON c.person_id = anc.id
      JOIN families f ON f.id = c.family_id
      JOIN persons parent ON (parent.id = f.partner1_id OR parent.id = f.partner2_id)
        AND parent.id != anc.id
      WHERE parent.deleted_at IS NULL AND anc.generation < 20
    )
    SELECT anc.id, anc.generation, pn.given_name, pn.surname
    FROM anc
    JOIN person_names pn ON pn.person_id = anc.id AND pn.is_primary = 1
  `);

  // Find all ancestors of person2 with generations
  const ancestors2 = db.all<{ id: string; generation: number; given_name: string; surname: string }>(sql`
    WITH RECURSIVE anc AS (
      SELECT p.id, 0 as generation
      FROM persons p WHERE p.id = ${person2Id} AND p.deleted_at IS NULL
      UNION ALL
      SELECT parent.id, anc.generation + 1
      FROM anc
      JOIN children c ON c.person_id = anc.id
      JOIN families f ON f.id = c.family_id
      JOIN persons parent ON (parent.id = f.partner1_id OR parent.id = f.partner2_id)
        AND parent.id != anc.id
      WHERE parent.deleted_at IS NULL AND anc.generation < 20
    )
    SELECT anc.id, anc.generation, pn.given_name, pn.surname
    FROM anc
    JOIN person_names pn ON pn.person_id = anc.id AND pn.is_primary = 1
  `);

  // Find common ancestors
  const ancMap1 = new Map(ancestors1.map(a => [a.id, a]));
  let bestCommon: { id: string; gen1: number; gen2: number; name: string } | null = null;

  for (const a2 of ancestors2) {
    const a1 = ancMap1.get(a2.id);
    if (a1) {
      const totalGens = a1.generation + a2.generation;
      if (!bestCommon || totalGens < (bestCommon.gen1 + bestCommon.gen2)) {
        bestCommon = {
          id: a2.id,
          gen1: a1.generation,
          gen2: a2.generation,
          name: `${a1.given_name} ${a1.surname}`,
        };
      }
    }
  }

  if (!bestCommon) {
    return {
      relationship: 'no relationship found',
      path: [],
      commonAncestor: null,
      generationsRemoved: 0,
    };
  }

  const relationship = getRelationshipLabel(bestCommon.gen1, bestCommon.gen2);

  return {
    relationship,
    path: [person1Id, bestCommon.id, person2Id],
    commonAncestor: { id: bestCommon.id, name: bestCommon.name },
    generationsRemoved: Math.abs(bestCommon.gen1 - bestCommon.gen2),
  };
}

/**
 * Create the computeRelationship tool bound to a database instance.
 */
export function createComputeRelationshipTool(db: Database) {
  return tool({
    description: 'Compute and explain the relationship between two people in the tree',
    parameters: z.object({
      person1Id: z.string().describe('First person ID'),
      person2Id: z.string().describe('Second person ID'),
    }),
    execute: async ({ person1Id, person2Id }) =>
      executeComputeRelationship(db, person1Id, person2Id),
  });
}
