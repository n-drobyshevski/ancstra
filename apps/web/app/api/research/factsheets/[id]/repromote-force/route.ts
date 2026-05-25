import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  _unmergeFactsheetInTransaction,
  _promoteSingleFactsheetInTransaction,
  _forceRepromoteClusterMemberInTransaction,
  computePatchDiff,
  hashPatchDiff,
  getClusterMembership,
  logReverseEvent,
  requireReason,
  ReasonRequiredError,
} from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

/**
 * Bundle C 2026-05-24 — STR-9 force-repromote.
 * Atomically unmerges the existing person and re-promotes the factsheet,
 * discarding any manual edits since the prior promote. Caller must echo back
 * the diffHash from the 409 PersonDirty response; mismatch → 409 StaleDiff
 * with the updated diff.
 *
 * Bundle D Task 11 (2026-05-25) — cluster-member branch.
 *   - `precise` → surgical in-place person swap (preserves cluster identity,
 *     other cluster members untouched). See spec §3.4.
 *   - `legacy`  → 422 LegacyClusterNotSupported.
 *   - `no`      → existing solo unmerge+re-promote path.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §2.1.3
 *      docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §3.4
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id: factsheetId } = await params;
    const body = await request.json();
    const reason = requireReason(body, 'repromote-force');

    if (typeof body.diffHash !== 'string' || body.diffHash.length !== 64) {
      return NextResponse.json(
        { error: 'diffHash is required (64-char hex)' },
        { status: 400 },
      );
    }
    const userDiffHash: string = body.diffHash;
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    // Cluster guard first — three-state branch.
    const membership = await getClusterMembership(familyDb, factsheetId);

    if (membership.kind === 'legacy') {
      return NextResponse.json(
        {
          error: 'LegacyClusterNotSupported',
          message:
            'This factsheet appears to be part of a legacy cluster ' +
            '(pre-Bundle-D promotion). Force-repromote on legacy clusters ' +
            'is not yet supported.',
        },
        { status: 422 },
      );
    }

    if (membership.kind === 'precise') {
      // -----------------------------------------------------------------
      // Bundle D Task 11 — cluster-member surgical swap.
      // -----------------------------------------------------------------
      const rows = await familyDb.all<{ promoted_person_id: string | null }>(sql`
        SELECT promoted_person_id FROM factsheets WHERE id = ${factsheetId}
      `);
      const personIdOld = rows[0]?.promoted_person_id;
      if (!personIdOld) {
        // Shouldn't happen — `kind: 'precise'` requires a stamped cluster id,
        // which is only written at promote time alongside promoted_person_id.
        return NextResponse.json(
          {
            error: 'FactsheetNotPromoted',
            message:
              'Cluster membership detected but factsheet has no promoted_person_id.',
          },
          { status: 422 },
        );
      }

      const now = new Date().toISOString();
      let swapResult: {
        factsheetId: string;
        previousPersonId: string;
        personId: string;
        clusterPromotionId: string;
      };

      await familyDb.run(sql`BEGIN IMMEDIATE`);
      try {
        swapResult = await _forceRepromoteClusterMemberInTransaction(
          familyDb,
          {
            factsheetId,
            reason,
            actorId: ctx.userId,
            threadId,
            clusterPromotionId: membership.clusterPromotionId,
            personIdOld,
          },
          now,
        );

        await logReverseEvent({
          db: familyDb,
          eventType: 'factsheet_force_repromoted',
          reason,
          actorId: ctx.userId,
          threadId: threadId ?? null,
          factsheetId,
          personId: swapResult.personId,
          payload: {
            previousPersonId: swapResult.previousPersonId,
            clusterPromotionId: swapResult.clusterPromotionId,
            clusterMember: true,
          },
        });

        await familyDb.run(sql`COMMIT`);
      } catch (err) {
        await familyDb.run(sql`ROLLBACK`);
        throw err;
      }

      revalidateTag('persons', 'max');
      revalidateTag('tree-data', 'max');
      revalidateTag('dashboard-stats', 'max');
      revalidateTag('factsheets', 'max');
      revalidateTag('factsheets-list', 'max');
      revalidateTag(`factsheet-${factsheetId}`, 'max');
      revalidateTag('factsheet-count', 'max');
      revalidateTag('inbox-count', 'max');

      return NextResponse.json({
        factsheetId: swapResult.factsheetId,
        personId: swapResult.personId,
        previousPersonId: swapResult.previousPersonId,
        clusterMember: true,
      });
    }

    // -----------------------------------------------------------------
    // membership.kind === 'no' — existing solo force-repromote path.
    // -----------------------------------------------------------------

    // Recompute diff + hash; refuse if stale
    const currentDiff = await computePatchDiff(familyDb, factsheetId);
    const currentDiffHash = hashPatchDiff(currentDiff);
    if (currentDiffHash !== userDiffHash) {
      return NextResponse.json(
        {
          error: 'StaleDiff',
          message:
            'The person was edited again while you were reviewing. Updated diff shown.',
          currentDiff,
          currentDiffHash,
        },
        { status: 409 },
      );
    }

    // Atomic unmerge + re-promote in ONE outer transaction
    await familyDb.run(sql`BEGIN IMMEDIATE`);
    let oldPersonId: string;
    let newPersonId: string;
    try {
      const unmergeResult = await _unmergeFactsheetInTransaction(familyDb, {
        factsheetId,
        // Force-repromote explicitly discards manual edits; dirty check already
        // passed at the route level (diffHash confirmed). Skip the inner check
        // so the force path is not blocked by PersonDirtyError.
        skipDirtyCheck: true,
      });
      oldPersonId = unmergeResult.personId;

      const now = new Date().toISOString();
      const promoteResult = await _promoteSingleFactsheetInTransaction(
        familyDb,
        {
          factsheetId,
          mode: 'create',
          userId: ctx.userId,
          threadId,
          skipValidation: true,
        },
        now,
      );
      newPersonId = promoteResult.personId;

      await logReverseEvent({
        db: familyDb,
        eventType: 'factsheet_force_repromoted',
        reason,
        actorId: ctx.userId,
        threadId: threadId ?? null,
        factsheetId,
        personId: newPersonId,
        payload: { oldPersonId, newPersonId, diff: currentDiff },
      });

      await familyDb.run(sql`COMMIT`);
    } catch (err) {
      await familyDb.run(sql`ROLLBACK`);
      throw err;
    }

    revalidateTag('persons', 'max');
    revalidateTag('tree-data', 'max');
    revalidateTag('dashboard-stats', 'max');
    revalidateTag('factsheets', 'max');
    revalidateTag('factsheets-list', 'max');
    revalidateTag(`factsheet-${factsheetId}`, 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({
      mode: 'force-repromoted',
      personId: newPersonId,
      oldPersonId,
      diff: currentDiff,
    });
  } catch (err) {
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json(
        { error: 'reason-required', message: err.message },
        { status: 400 },
      );
    }
    try {
      return handleAuthError(err);
    } catch {
      /* not auth */
    }
    console.error('[factsheets/[id]/repromote-force POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
