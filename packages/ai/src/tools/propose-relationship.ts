import { tool } from 'ai';
import { z } from 'zod/v3';
import { sql } from 'drizzle-orm';
import { factsheets, researchFacts, bandConfidence, relationshipToFactType } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import { addEvent } from '@ancstra/research';

interface FactsheetResult {
  factsheetId: string;
  status: 'draft';
  message: string;
}

/**
 * Bundle A 2026-05-23 — was: INSERT into proposed_relationships.
 * Now: materialise a draft factsheet (entityType='family_unit') with one
 * research_fact carrying the relationship assertion. The user reviews this
 * factsheet in the standard factsheet UI; on promotion it becomes a
 * families/children row.
 *
 * See: docs/superpowers/specs/2026-05-23-research-flow-unification-bundle-a-design.md §2.2
 */
export async function executeProposeRelationship(
  db: Database,
  params: {
    person1Id: string;
    person2Id: string;
    relationshipType: 'parent_child' | 'partner' | 'sibling';
    evidence: string;
    confidence: number;
    sourceRecordId?: string;
    threadId?: string | null;
    actorId?: string;
  },
): Promise<FactsheetResult> {
  const { person1Id, person2Id, relationshipType, evidence, confidence, sourceRecordId } = params;
  const actorId = params.actorId ?? 'ai';

  const p1 = await db.all<{ id: string; given_name: string | null; surname: string | null }>(sql`
    SELECT p.id, pn.given_name, pn.surname
    FROM persons p
    LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    WHERE p.id = ${person1Id} AND p.deleted_at IS NULL
  `);
  if (p1.length === 0) {
    return { factsheetId: '', status: 'draft', message: `Person ${person1Id} not found` };
  }
  const p2 = await db.all<{ id: string; given_name: string | null; surname: string | null }>(sql`
    SELECT p.id, pn.given_name, pn.surname
    FROM persons p
    LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_primary = 1
    WHERE p.id = ${person2Id} AND p.deleted_at IS NULL
  `);
  if (p2.length === 0) {
    return { factsheetId: '', status: 'draft', message: `Person ${person2Id} not found` };
  }

  const name1 = [p1[0].given_name, p1[0].surname].filter(Boolean).join(' ') || person1Id;
  const name2 = [p2[0].given_name, p2[0].surname].filter(Boolean).join(' ') || person2Id;
  const factType = relationshipToFactType(relationshipType);
  const factValue = `${name2} (${relationshipType})`;

  // Duplicate detection — same (person1, factType, factValue) on a draft factsheet.
  const existing = await db.all<{ factsheet_id: string }>(sql`
    SELECT DISTINCT factsheet_id FROM research_facts
    WHERE person_id = ${person1Id}
      AND fact_type = ${factType}
      AND fact_value = ${factValue}
      AND factsheet_id IN (SELECT id FROM factsheets WHERE status = 'draft')
  `);
  if (existing.length > 0 && existing[0].factsheet_id) {
    return {
      factsheetId: existing[0].factsheet_id,
      status: 'draft',
      message: 'A draft factsheet for this relationship already exists',
    };
  }

  const now = new Date().toISOString();
  const fsId = crypto.randomUUID();
  const factId = crypto.randomUUID();

  await db.insert(factsheets).values({
    id: fsId,
    title: `${name1} <-> ${name2}: ${relationshipType}`,
    entityType: 'family_unit',
    status: 'draft',
    notes: sourceRecordId ? `${evidence} (source: ${sourceRecordId})` : evidence,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
    createdThreadId: params.threadId ?? null,
  }).run();

  const provenance: 'derived' | 'user_inference' = sourceRecordId ? 'derived' : 'user_inference';

  await db.insert(researchFacts).values({
    id: factId,
    personId: person1Id,
    factType,
    factValue,
    researchItemId: sourceRecordId ?? null,
    factsheetId: fsId,
    confidence: bandConfidence(confidence),
    contested: false,
    provenance,
    extractionMethod: 'ai_extracted',
    createdAt: now,
    updatedAt: now,
  }).run();

  if (params.threadId) {
    try {
      await addEvent(db, {
        threadId: params.threadId,
        eventType: 'factsheet_created',
        actorId,
        factsheetId: fsId,
        personId: person1Id,
        reason: `AI proposed ${relationshipType} between ${name1} and ${name2}: ${evidence}`,
        payload: { factsheetId: fsId, person2Id, confidence: bandConfidence(confidence), sourceRecordId: sourceRecordId ?? null },
      });
    } catch (err) {
      console.warn('[propose-relationship] thread event emission failed:', err);
    }
  }

  return {
    factsheetId: fsId,
    status: 'draft',
    message: `Draft factsheet created. Review it to confirm the ${relationshipType} connection.`,
  };
}

/**
 * Create the proposeRelationship tool bound to a database instance.
 *
 * @param db - Family database instance.
 * @param opts.threadId - Optional active research thread id. When set, a
 *   `factsheet_created` event is emitted after each successful proposal so
 *   the timeline reflects the AI's activity. Emission failure never blocks the
 *   factsheet creation.
 * @param opts.actorId - Actor id recorded on the event (default: 'ai').
 */
export function createProposeRelationshipTool(
  db: Database,
  opts?: { threadId?: string | null; actorId?: string },
) {
  return tool({
    description:
      'Propose a relationship between two people based on discovered evidence. Creates a draft factsheet that the user reviews — does NOT directly modify the family tree.',
    inputSchema: z.object({
      person1Id: z.string().describe('First person ID (parent for parent-child)'),
      person2Id: z.string().describe('Second person ID (child for parent-child)'),
      relationshipType: z.enum(['parent_child', 'partner', 'sibling'])
        .describe('Type of relationship discovered'),
      evidence: z.string().describe('Summary of evidence supporting this relationship'),
      confidence: z.number().min(0).max(1).describe('Confidence level 0-1'),
      sourceRecordId: z.string().optional().describe('ID of the source record (research_item id) that supports this'),
    }),
    execute: async (params) =>
      executeProposeRelationship(db, {
        ...params,
        threadId: opts?.threadId,
        actorId: opts?.actorId,
      }),
  });
}
