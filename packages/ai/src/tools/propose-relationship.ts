import { tool } from 'ai';
import { z } from 'zod/v3';
import { sql, eq, and } from 'drizzle-orm';
import { proposedRelationships, persons } from '@ancstra/db';
import type { Database } from '@ancstra/db';
import { addEvent } from '@ancstra/research';

interface ProposalResult {
  proposalId: string;
  status: 'pending';
  message: string;
}

/**
 * Execute the propose relationship operation.
 * Creates a pending proposal in the proposed_relationships table.
 * Optionally emits a thread event when threadId is provided (fire-and-forget;
 * emission failure never rolls back the proposal).
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
  }
): Promise<ProposalResult> {
  const { person1Id, person2Id, relationshipType, evidence, confidence, sourceRecordId } = params;

  // Validate both persons exist
  const p1Rows = await db.all<{ id: string }>(sql`
    SELECT id FROM persons WHERE id = ${person1Id} AND deleted_at IS NULL
  `);
  if (p1Rows.length === 0) {
    return { proposalId: '', status: 'pending', message: `Person ${person1Id} not found` };
  }

  const p2Rows = await db.all<{ id: string }>(sql`
    SELECT id FROM persons WHERE id = ${person2Id} AND deleted_at IS NULL
  `);
  if (p2Rows.length === 0) {
    return { proposalId: '', status: 'pending', message: `Person ${person2Id} not found` };
  }

  // Check for duplicate proposal
  const existing = await db.all<{ id: string }>(sql`
    SELECT id FROM proposed_relationships
    WHERE person1_id = ${person1Id}
      AND person2_id = ${person2Id}
      AND relationship_type = ${relationshipType}
      AND status = 'pending'
  `);
  if (existing.length > 0) {
    return {
      proposalId: existing[0].id,
      status: 'pending',
      message: 'A pending proposal for this relationship already exists',
    };
  }

  // Build source detail
  const sourceDetail = sourceRecordId
    ? `${evidence} (source: ${sourceRecordId})`
    : evidence;

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(proposedRelationships)
    .values({
      id,
      relationshipType,
      person1Id,
      person2Id,
      sourceType: 'ai_suggestion',
      sourceDetail,
      confidence,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (params.threadId) {
    try {
      await addEvent(db, {
        threadId: params.threadId,
        eventType: 'note_added',
        actorId: params.actorId ?? 'ai',
        personId: params.person1Id,
        reason: `AI proposed ${relationshipType} between ${params.person1Id} and ${params.person2Id}: ${evidence}`,
        payload: {
          proposalId: id,
          person2Id: params.person2Id,
          confidence,
          sourceRecordId: params.sourceRecordId ?? null,
        },
      });
    } catch (err) {
      // Don't fail the proposal if event emission fails — log only.
      console.warn('[propose-relationship] thread event emission failed:', err);
    }
  }

  return {
    proposalId: id,
    status: 'pending',
    message: `Relationship proposal created. An editor will review this ${relationshipType} connection.`,
  };
}

/**
 * Create the proposeRelationship tool bound to a database instance.
 *
 * @param db - Family database instance.
 * @param opts.threadId - Optional active research thread id. When set, a
 *   `note_added` event is emitted after each successful proposal so the
 *   timeline reflects the AI's activity. Emission failure never blocks the
 *   proposal.
 * @param opts.actorId - Actor id recorded on the event (default: 'ai').
 */
export function createProposeRelationshipTool(
  db: Database,
  opts?: { threadId?: string | null; actorId?: string },
) {
  return tool({
    description: 'Propose a relationship between two people based on discovered evidence. Creates a pending proposal for editor validation — does NOT directly modify the family tree.',
    inputSchema: z.object({
      person1Id: z.string().describe('First person ID (parent for parent-child)'),
      person2Id: z.string().describe('Second person ID (child for parent-child)'),
      relationshipType: z.enum(['parent_child', 'partner', 'sibling'])
        .describe('Type of relationship discovered'),
      evidence: z.string().describe('Summary of evidence supporting this relationship'),
      confidence: z.number().min(0).max(1).describe('Confidence level 0-1'),
      sourceRecordId: z.string().optional().describe('ID of the source record that supports this'),
    }),
    execute: async (params) =>
      executeProposeRelationship(db, {
        ...params,
        threadId: opts?.threadId,
        actorId: opts?.actorId,
      }),
  });
}
