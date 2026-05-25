import { sql } from 'drizzle-orm';
import type { Database } from '@ancstra/db';
import { _createPersonFromFactsheet, _writeFactsheetEvidence } from './promote-helpers';

/**
 * Bundle D Task 11 (2026-05-25) — Cluster-member surgical swap for
 * `POST /repromote-force`.
 *
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §3.4.
 *
 * Force-repromote on a cluster member factsheet replaces JUST that one
 * person — the cluster's family graph (other members + family edges) stays
 * intact, and `cluster_promotion_id` is preserved (cluster identity is stable
 * across the swap).
 *
 * FK-correctness: under `PRAGMA foreign_keys = ON` the family-edge rows
 * reference `persons` via `families.partner1_id` / `partner2_id` (ON DELETE
 * SET NULL) and `children.person_id` (ON DELETE CASCADE). Deleting
 * `personIdOld` before repointing those FKs would either nullify spouse
 * pointers or cascade-delete child rows. We therefore:
 *
 *   1. Create the new person first (both old + new exist; FKs satisfied).
 *   2. UPDATE every family-edge pointer OLD → NEW.
 *   3. Flip the factsheet pointer.
 *   4. Write fresh evidence rows attached to the new person.
 *   5. Only THEN delete the old person + its now-orphaned evidence.
 *
 * Caller MUST have opened an outer BEGIN IMMEDIATE transaction; this function
 * does NOT open/commit its own transaction. Audit event written by the caller
 * inside the same outer transaction.
 */

export interface ForceRepromoteClusterMemberInput {
  factsheetId: string;
  reason: string;
  actorId: string;
  threadId?: string | null;
  clusterPromotionId: string;
  personIdOld: string;
}

export interface ForceRepromoteClusterMemberResult {
  factsheetId: string;
  previousPersonId: string;
  personId: string;
  clusterPromotionId: string;
}

/**
 * Cluster-member surgical person swap. See file header for the FK-correct
 * algorithm. Returns the new person id + the prior (now-deleted) person id +
 * the stable `clusterPromotionId`.
 *
 * Caller is responsible for:
 *   - Opening the outer BEGIN IMMEDIATE transaction.
 *   - Writing the `factsheet_force_repromoted` audit event (with the
 *     cluster-member payload shape — `clusterMember: true`).
 *   - Calling COMMIT/ROLLBACK.
 *   - Cache invalidation after commit.
 */
export async function _forceRepromoteClusterMemberInTransaction(
  db: Database,
  input: ForceRepromoteClusterMemberInput,
  now: string,
): Promise<ForceRepromoteClusterMemberResult> {
  const { factsheetId, clusterPromotionId, personIdOld, actorId } = input;

  // Step 1: create the new person row from the factsheet's accepted facts.
  // The helper INSERTs `persons` + a primary `person_names` row. It does NOT
  // touch the factsheets row, families, children, or any evidence tables.
  const personIdNew = await _createPersonFromFactsheet(
    db,
    factsheetId,
    actorId,
    now,
  );

  // Step 2: repoint family-edge pointers OLD → NEW. Both persons still exist
  // at this point, so the FK constraints on families/children are satisfied
  // throughout the UPDATE.
  await db.run(sql`
    UPDATE families SET partner1_id = ${personIdNew}, updated_at = ${now}
    WHERE partner1_id = ${personIdOld}
  `);
  await db.run(sql`
    UPDATE families SET partner2_id = ${personIdNew}, updated_at = ${now}
    WHERE partner2_id = ${personIdOld}
  `);
  // `children` has no `updated_at` column (see family-schema.ts).
  await db.run(sql`
    UPDATE children SET person_id = ${personIdNew}
    WHERE person_id = ${personIdOld}
  `);

  // Step 3: flip the factsheet's promoted_person_id. `cluster_promotion_id`
  // is intentionally NOT touched — cluster identity is the cluster's, not
  // any individual person's, and must stay stable so subsequent cluster ops
  // (e.g. unmerge-cluster) still find this factsheet as a member.
  await db.run(sql`
    UPDATE factsheets
    SET promoted_person_id = ${personIdNew},
        promoted_at = ${now},
        updated_at = ${now}
    WHERE id = ${factsheetId}
  `);

  // Step 4: write fresh evidence (events + sources + source_citations +
  // research_facts.source_citation_id back-link) for the new person, mirroring
  // what was written at original cluster-promote time.
  await _writeFactsheetEvidence(db, factsheetId, personIdNew, actorId, now);

  // Step 5: clean up the old person + its evidence. All FK references have
  // been repointed (families.partner{1,2}_id and children.person_id), so
  // DELETE FROM persons is now FK-safe under PRAGMA foreign_keys=ON.
  //
  // We delete events + source_citations explicitly first for predictable
  // counts and to match the spec §3.4 algorithm exactly. The schema's
  // ON DELETE CASCADE on `events.person_id` and `source_citations.person_id`
  // would handle them otherwise — but explicit is safer if FK enforcement
  // is ever paused in a test fixture.
  await db.run(sql`DELETE FROM events WHERE person_id = ${personIdOld}`);
  await db.run(sql`DELETE FROM source_citations WHERE person_id = ${personIdOld}`);
  await db.run(sql`DELETE FROM persons WHERE id = ${personIdOld}`);

  return {
    factsheetId,
    previousPersonId: personIdOld,
    personId: personIdNew,
    clusterPromotionId,
  };
}
