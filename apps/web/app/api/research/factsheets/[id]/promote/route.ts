import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  promoteSingleFactsheet,
  promoteFactsheetCluster,
  isClusterPromoted,
  isPersonDirtySincePromote,
  computePatchDiff,
  applyPatchDiff,
  hashPatchDiff,
  LegacyPromotionNotPatchableError,
  logReverseEvent,
  requireReason,
  ReasonRequiredError,
} from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

/**
 * Bundle C 2026-05-24 — STR-9 factsheet→person live link.
 * Auto-detects first-promote vs second-promote (PATCH-on-clean / refuse-on-dirty).
 * Cluster mode (body.cluster === true) preserved from Bundle A behavior.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §2.1.1
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id: factsheetId } = await params;
    const body = await request.json();
    const reason = requireReason(body, 'promote');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    // -----------------------------------------------------------------------
    // Cluster-promotion branch (existing Bundle A behavior preserved)
    // -----------------------------------------------------------------------
    if (body.cluster === true) {
      const result = await promoteFactsheetCluster(familyDb, factsheetId, ctx.userId, threadId);
      revalidateAll(factsheetId);
      return NextResponse.json(result);
    }

    // -----------------------------------------------------------------------
    // Auto-detect: read current factsheet state
    // -----------------------------------------------------------------------
    const fsRow = (await familyDb.all<{
      status: string;
      promoted_person_id: string | null;
    }>(sql`
      SELECT status, promoted_person_id FROM factsheets WHERE id = ${factsheetId}
    `))[0];
    if (!fsRow) {
      return NextResponse.json({ error: 'FactsheetNotFound' }, { status: 404 });
    }

    // -----------------------------------------------------------------------
    // 422 paths — unsupported states
    // -----------------------------------------------------------------------
    if (fsRow.status === 'merged') {
      return NextResponse.json({
        error: 'FactsheetMergedNotSupported',
        message: 'This factsheet was promoted via merge mode. Use unmerge then re-promote.',
      }, { status: 422 });
    }
    if (fsRow.status === 'dismissed') {
      return NextResponse.json({
        error: 'FactsheetNotPromotable',
        message: 'Dismissed factsheets must be restored before promoting.',
      }, { status: 422 });
    }

    // -----------------------------------------------------------------------
    // First-promote path (status='draft' | 'ready')
    // -----------------------------------------------------------------------
    if (fsRow.status === 'draft' || fsRow.status === 'ready') {
      const mode = body.mode ?? 'create';
      if (mode !== 'create' && mode !== 'merge') {
        return NextResponse.json({ error: 'mode must be "create" or "merge"' }, { status: 400 });
      }
      if (mode === 'merge' && !body.mergeTargetPersonId) {
        return NextResponse.json({ error: 'mergeTargetPersonId required for merge mode' }, { status: 400 });
      }
      const result = await promoteSingleFactsheet(familyDb, {
        factsheetId,
        mode,
        mergeTargetPersonId: body.mergeTargetPersonId,
        userId: ctx.userId,
        threadId,
      });
      revalidateAll(factsheetId);
      return NextResponse.json({
        mode: 'first',
        personId: result.personId,
        eventsCreated: result.eventsCreated,
        sourcesCreated: result.sourcesCreated,
      });
    }

    // Data-integrity guard: status='promoted' but no promoted_person_id is
    // corruption (or a migration gap). Surface explicitly instead of falling
    // through to UnsupportedState which would be a misleading diagnostic.
    if (fsRow.status === 'promoted' && !fsRow.promoted_person_id) {
      return NextResponse.json({
        error: 'PromotedWithoutPersonId',
        message: 'Factsheet status is promoted but promoted_person_id is null. Manual repair required.',
      }, { status: 422 });
    }

    // -----------------------------------------------------------------------
    // PATCH-on-clean / refuse-on-dirty path (status='promoted')
    // -----------------------------------------------------------------------
    if (fsRow.status === 'promoted' && fsRow.promoted_person_id) {
      // Cluster guard FIRST — patching one factsheet in a cluster can't
      // express what the user actually wants for the partner/child links.
      if (await isClusterPromoted(familyDb, factsheetId)) {
        return NextResponse.json({ error: 'ClusterUnsupported' }, { status: 422 });
      }

      // Compute diff. May throw LegacyPromotionNotPatchableError when the
      // person has any events without source_factsheet_id (pure legacy or
      // mixed-state — both cases would silently duplicate untracked rows).
      let diff;
      try {
        diff = await computePatchDiff(familyDb, factsheetId);
      } catch (err) {
        if (err instanceof LegacyPromotionNotPatchableError) {
          return NextResponse.json({
            error: 'LegacyPromotionNotPatchable',
            message: err.message,
          }, { status: 422 });
        }
        throw err;
      }

      // Dirty check — read promoted_at, then compare against any newer
      // updated_at on the person or its events.
      const fsTimestamps = (await familyDb.all<{ promoted_at: string }>(sql`
        SELECT promoted_at FROM factsheets WHERE id = ${factsheetId}
      `))[0];
      if (
        fsTimestamps?.promoted_at &&
        await isPersonDirtySincePromote(familyDb, fsRow.promoted_person_id, fsTimestamps.promoted_at)
      ) {
        const diffHash = hashPatchDiff(diff);
        return NextResponse.json({
          error: 'PersonDirty',
          personId: fsRow.promoted_person_id,
          diff,
          diffHash,
        }, { status: 409 });
      }

      // Clean — apply patch atomically (helpers run inside an outer tx).
      await familyDb.run(sql`BEGIN IMMEDIATE`);
      try {
        const counts = await applyPatchDiff(familyDb, diff, { actorId: ctx.userId });
        await logReverseEvent({
          db: familyDb,
          eventType: 'factsheet_patched',
          reason,
          actorId: ctx.userId,
          threadId: threadId ?? null,
          factsheetId,
          personId: fsRow.promoted_person_id,
          payload: { diff, mode: 'patched' },
        });
        await familyDb.run(sql`COMMIT`);
        revalidateAll(factsheetId);
        return NextResponse.json({
          mode: 'patched',
          personId: fsRow.promoted_person_id,
          diff,
          ...counts,
        });
      } catch (err) {
        await familyDb.run(sql`ROLLBACK`);
        throw err;
      }
    }

    return NextResponse.json(
      { error: 'UnsupportedState', status: fsRow.status },
      { status: 422 },
    );
  } catch (err) {
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json(
        { error: 'reason-required', message: err.message },
        { status: 400 },
      );
    }
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/promote POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function revalidateAll(factsheetId: string) {
  revalidateTag('persons', 'max');
  revalidateTag('tree-data', 'max');
  revalidateTag('dashboard-stats', 'max');
  revalidateTag('factsheets', 'max');
  revalidateTag('factsheets-list', 'max');
  revalidateTag(`factsheet-${factsheetId}`, 'max');
  revalidateTag('factsheet-count', 'max');
  revalidateTag('inbox-count', 'max');
}
