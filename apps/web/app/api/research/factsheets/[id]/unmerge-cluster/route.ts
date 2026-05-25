import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  unmergeFactsheetCluster,
  FactsheetNotPromotedAsClusterError,
  LegacyClusterNotSupportedError,
  requireReason,
  ReasonRequiredError,
} from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

/**
 * Bundle D 2026-05-25 — atomic reverse of promoteFactsheetCluster.
 * Reverses an entire cluster promotion in one transaction: deletes families/
 * children edges, calls per-member _unmergeFactsheetInTransaction, clears
 * cluster_promotion_id, and writes per-member audit events with a shared
 * clusterUnmergeId correlation id.
 *
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §6.1
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: factsheetId } = await params;
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'unmerge-cluster');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const result = await unmergeFactsheetCluster(familyDb, {
      factsheetId,
      reason,
      actorId: ctx.userId,
      threadId,
    });

    revalidateTag('persons', 'max');
    revalidateTag('tree-data', 'max');
    revalidateTag('dashboard-stats', 'max');
    revalidateTag('factsheets', 'max');
    revalidateTag('factsheets-list', 'max');
    revalidateTag(`factsheet-${factsheetId}`, 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({
      memberCount: result.memberCount,
      clusterUnmergeId: result.clusterUnmergeId,
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    if (err instanceof FactsheetNotPromotedAsClusterError) {
      return NextResponse.json({
        error: 'FactsheetNotPromotedAsCluster',
        message: err.message,
      }, { status: 422 });
    }
    if (err instanceof LegacyClusterNotSupportedError) {
      return NextResponse.json({
        error: 'LegacyClusterNotSupported',
        message: err.message,
      }, { status: 422 });
    }
    console.error('[factsheets/[id]/unmerge-cluster POST]', err);
    throw err;
  }
}
