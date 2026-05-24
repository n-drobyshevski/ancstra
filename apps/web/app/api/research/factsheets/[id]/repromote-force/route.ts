import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  _unmergeFactsheetInTransaction,
  _promoteSingleFactsheetInTransaction,
  computePatchDiff,
  hashPatchDiff,
  isClusterPromoted,
  logReverseEvent,
  requireReason,
  ReasonRequiredError,
  ClusterPromotedError,
} from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

/**
 * Bundle C 2026-05-24 — STR-9 force-repromote.
 * Atomically unmerges the existing person and re-promotes the factsheet,
 * discarding any manual edits since the prior promote. Caller must echo back
 * the diffHash from the 409 PersonDirty response; mismatch → 409 StaleDiff
 * with the updated diff.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §2.1.3
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

    // Cluster guard first
    if (await isClusterPromoted(familyDb, factsheetId)) {
      return NextResponse.json({ error: 'ClusterUnsupported' }, { status: 422 });
    }

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
    if (err instanceof ClusterPromotedError) {
      return NextResponse.json(
        { error: 'ClusterUnsupported', message: err.message },
        { status: 422 },
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
