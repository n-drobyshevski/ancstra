import { eq, sql } from 'drizzle-orm';
import {
  factsheets,
  factsheetLinks,
  families,
  children,
  refreshSummary,
} from '@ancstra/db';
import type { Database } from '@ancstra/db';
import { isFactsheetPromotable } from './validation';
import { getFactsheetCluster } from './links';
import { _createPersonFromFactsheet, _writeFactsheetEvidence } from './promote-helpers';
import { addEvent } from '../threads/events';

export interface PromoteSingleInput {
  factsheetId: string;
  mode: 'create' | 'merge';
  mergeTargetPersonId?: string;
  userId: string;
  /** Skip promotability validation for programmatic callers. */
  skipValidation?: boolean;
  /** When set, emits a 'factsheet_promoted' thread event after success. */
  threadId?: string | null;
  /**
   * Bundle D 2026-05-25: cluster identity stamp. When set, written to the
   * factsheets row's `cluster_promotion_id` column at promote time. Generated
   * by promoteFactsheetCluster (one UUID per cluster, shared across members).
   * Unused for solo promote. See spec §3.1.
   */
  clusterPromotionId?: string;
}

export interface PromoteSingleResult {
  personId: string;
  eventsCreated: number;
  sourcesCreated: number;
  mode: 'created' | 'merged';
}

export interface PromoteClusterResult {
  personsCreated: number;
  familiesCreated: number;
  childLinksCreated: number;
  results: PromoteSingleResult[];
}

/**
 * Inner transaction body for single-factsheet promote. Caller MUST have
 * opened a transaction; responsible for COMMIT/ROLLBACK.
 *
 * Used by:
 *   - public `promoteSingleFactsheet` (wraps with own transaction)
 *   - /repromote-force endpoint (one outer transaction wraps unmerge+promote)
 *
 * Behavior is identical to the previous inline body with one exception:
 *   - The events INSERT now sets `sourceFactsheetId` (Bundle C Task 1 added
 *     the column; this task populates it on every first-promote so we can
 *     later surface "promoted from factsheet X" + drive force-repromote).
 *
 * Does NOT call `refreshSummary` or emit thread events — those live in the
 * public wrapper so /repromote-force can choose when to fire them after the
 * combined outer transaction commits.
 *
 * The `now` ISO timestamp is threaded from the caller so unmerge + promote
 * inside the same outer transaction share a consistent timestamp.
 *
 * Bundle D Task 8 (2026-05-25): the data-creation phases (person + evidence)
 * are now delegated to the private helpers in `./promote-helpers` so the
 * Task 11 surgical-swap path in `/repromote-force` can reuse them. This
 * function retains responsibility for the factsheets-row state flip.
 */
export async function _promoteSingleFactsheetInTransaction(
  db: Database,
  input: PromoteSingleInput,
  now: string,
): Promise<PromoteSingleResult> {
  const mode = input.mode;
  let personId: string;

  if (mode === 'create') {
    personId = await _createPersonFromFactsheet(db, input.factsheetId, input.userId, now);
  } else {
    // mode === 'merge' — caller supplied the target person. Validation in the
    // public wrapper guarantees mergeTargetPersonId is set.
    personId = input.mergeTargetPersonId!;
  }

  const { eventsCreated, sourcesCreated } = await _writeFactsheetEvidence(
    db,
    input.factsheetId,
    personId,
    input.userId,
    now,
  );

  // Update factsheet status
  await db.update(factsheets)
    .set({
      status: (mode === 'create' ? 'promoted' : 'merged') as any,
      promotedPersonId: personId,
      promotedAt: now,
      // Bundle D 2026-05-25: write the cluster identity when caller is
      // promoteFactsheetCluster. NULL for solo promote.
      clusterPromotionId: input.clusterPromotionId ?? null,
      updatedAt: now,
    })
    .where(eq(factsheets.id, input.factsheetId))
    .run();

  return {
    personId,
    eventsCreated,
    sourcesCreated,
    mode: mode === 'create' ? 'created' : 'merged',
  };
}

/**
 * Promote a single factsheet to a person.
 * Mode 'create': creates a new person from the factsheet's facts.
 * Mode 'merge': adds new facts/events to an existing person.
 *
 * Bundle C Task 5 refactor: extracted `_promoteSingleFactsheetInTransaction`
 * so /repromote-force can compose unmerge+promote in one outer transaction.
 * The public signature and behavior of this wrapper are unchanged.
 */
export async function promoteSingleFactsheet(
  db: Database,
  input: PromoteSingleInput,
): Promise<PromoteSingleResult> {
  // Validate promotability (skip when caller has already validated)
  if (!input.skipValidation) {
    const check = await isFactsheetPromotable(db, input.factsheetId);
    if (!check.promotable) {
      throw new Error(`Factsheet not promotable: ${check.blockers.join(', ')}`);
    }
  }

  if (input.mode === 'merge' && !input.mergeTargetPersonId) {
    throw new Error('mergeTargetPersonId required for merge mode');
  }

  // Fetch factsheet title once (needed for the thread event after success).
  const fsRows = await db.all<{ title: string }>(sql`
    SELECT title FROM factsheets WHERE id = ${input.factsheetId}
  `);
  const factsheetTitle = fsRows[0]?.title ?? input.factsheetId;

  const now = new Date().toISOString();
  let result: PromoteSingleResult;

  // Use explicit BEGIN/COMMIT/ROLLBACK — Drizzle's db.transaction(async tx)
  // breaks on better-sqlite3 (see project memory feedback_drizzle_transactions).
  await db.run(sql`BEGIN`);
  try {
    result = await _promoteSingleFactsheetInTransaction(db, input, now);
    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  // Promotion creates/updates events + source_citations for this person, so
  // person_summary needs a refresh to reflect the new facets (has_source,
  // sources_count, completeness, dates/places).
  await refreshSummary(db, result.personId);

  // Emit thread event when a research thread is active. Fire-and-forget:
  // emission failure must never roll back a successful promotion.
  if (input.threadId) {
    try {
      await addEvent(db, {
        threadId: input.threadId,
        eventType: 'factsheet_promoted',
        actorId: input.userId,
        factsheetId: input.factsheetId,
        personId: result.personId,
        reason: `Promoted "${factsheetTitle}" to person`,
      });
    } catch (err) {
      console.warn('[promoteSingleFactsheet] thread event emission failed:', err);
    }
  }

  return result;
}

/**
 * Promote a cluster of linked factsheets as a family unit.
 * Creates persons for each factsheet, then wires relationships
 * based on factsheet_links.
 *
 * Bundle D 2026-05-25 changes:
 *   - Generates a shared `clusterPromotionId` UUID and stamps it on every
 *     member factsheet via `_promoteSingleFactsheetInTransaction`. This
 *     enables precise (non-heuristic) cluster detection via `getClusterMembership`.
 *   - Phase 1 (promote each member) + phase 2 (wire families/children) now
 *     run inside a SINGLE outer `BEGIN IMMEDIATE / COMMIT / ROLLBACK` so the
 *     entire cluster promotion is atomic. Prior behavior wrote families/children
 *     in a SEPARATE transaction — a correctness gap where phase-2 failure
 *     could leave half-promoted cluster members.
 */
export async function promoteFactsheetCluster(
  db: Database,
  rootFactsheetId: string,
  userId: string,
  threadId?: string | null,
): Promise<PromoteClusterResult> {
  const clusterIds = await getFactsheetCluster(db, rootFactsheetId);
  if (clusterIds.length === 0) {
    throw new Error(`No cluster found for factsheet ${rootFactsheetId}`);
  }

  // Bundle D 2026-05-25: one UUID per cluster, stamped on every member
  // factsheet so getClusterMembership can resolve membership precisely
  // (replaces Bundle B's ±5s heuristic). See spec §3.1.
  const clusterPromotionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results: PromoteSingleResult[] = [];
  let familiesCreated = 0;
  let childLinksCreated = 0;
  const factsheetToPersonId = new Map<string, string>();

  // Bundle D 2026-05-25: phase 1 (promote each member) + phase 2 (wire
  // families/children) now share a single outer transaction so the whole
  // cluster is atomic. Prior behavior wrote families/children in a SEPARATE
  // transaction, which could leave a half-promoted cluster if phase 2 failed.
  await db.run(sql`BEGIN IMMEDIATE`);
  try {
    // Phase 1: promote each factsheet, stamping cluster_promotion_id.
    for (const fsId of clusterIds) {
      const result = await _promoteSingleFactsheetInTransaction(
        db,
        {
          factsheetId: fsId,
          mode: 'create',
          userId,
          threadId,
          skipValidation: true,
          clusterPromotionId,
        },
        now,
      );
      factsheetToPersonId.set(fsId, result.personId);
      results.push(result);
    }

    // Phase 2: wire relationships from links.
    for (const fsId of clusterIds) {
      const links = await db.select()
        .from(factsheetLinks)
        .where(eq(factsheetLinks.fromFactsheetId, fsId))
        .all();

      for (const link of links) {
        const fromPersonId = factsheetToPersonId.get(link.fromFactsheetId);
        const toPersonId = factsheetToPersonId.get(link.toFactsheetId);
        if (!fromPersonId || !toPersonId) continue;

        if (link.relationshipType === 'spouse') {
          const familyId = crypto.randomUUID();
          await db.insert(families)
            .values({
              id: familyId,
              partner1Id: fromPersonId,
              partner2Id: toPersonId,
              relationshipType: 'unknown',
              validationStatus: 'confirmed',
              createdAt: now,
              updatedAt: now,
            })
            .run();
          familiesCreated++;
        } else if (link.relationshipType === 'parent_child') {
          // from=parent, to=child — find or create family for parent.
          const existingFamilies = await db.all<{ id: string }>(sql`
            SELECT id FROM families
            WHERE partner1_id = ${fromPersonId} OR partner2_id = ${fromPersonId}
            LIMIT 1
          `);

          let familyId: string;
          if (existingFamilies.length > 0) {
            familyId = existingFamilies[0].id;
          } else {
            familyId = crypto.randomUUID();
            await db.insert(families)
              .values({
                id: familyId,
                partner1Id: fromPersonId,
                partner2Id: null,
                relationshipType: 'unknown',
                validationStatus: 'confirmed',
                createdAt: now,
                updatedAt: now,
              })
              .run();
            familiesCreated++;
          }

          await db.insert(children)
            .values({
              id: crypto.randomUUID(),
              familyId,
              personId: toPersonId,
              createdAt: now,
            })
            .run();
          childLinksCreated++;
        }
      }
    }

    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  return {
    personsCreated: results.length,
    familiesCreated,
    childLinksCreated,
    results,
  };
}
