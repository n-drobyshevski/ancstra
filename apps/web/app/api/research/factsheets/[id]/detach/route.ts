import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  softDetachFactsheet,
  requireReason,
  ReasonRequiredError,
  FactsheetNotPromotedError,
  ClusterDetachNotSupportedError,
  LegacyClusterNotSupportedError,
} from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

/**
 * Bundle C 2026-05-24 — STR-9 soft-detach a promoted factsheet.
 * Clears promoted_person_id + promoted_at, sets status=ready, leaves person
 * intact. Re-promoting later creates a fresh person (no re-link).
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §2.1.2
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: factsheetId } = await params;
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'detach');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const result = await softDetachFactsheet(familyDb, {
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

    return NextResponse.json(result);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    if (err instanceof FactsheetNotPromotedError) {
      return NextResponse.json({ error: 'FactsheetNotPromoted', message: err.message }, { status: 422 });
    }
    if (err instanceof ClusterDetachNotSupportedError) {
      return NextResponse.json({
        error: 'ClusterDetachNotSupported',
        hint: `/api/research/factsheets/${factsheetId}/unmerge-cluster`,
        message: 'Cannot detach a cluster member. Use Unmerge cluster instead, then detach individual factsheets.',
      }, { status: 422 });
    }
    if (err instanceof LegacyClusterNotSupportedError) {
      return NextResponse.json({
        error: 'LegacyClusterNotSupported',
        message: 'Legacy cluster (pre-Bundle-D) — cluster operations not yet supported.',
      }, { status: 422 });
    }
    console.error('[factsheets/[id]/detach POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
