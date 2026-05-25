import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  unmergeFactsheet,
  FactsheetNotPromotedError,
  PersonDirtyError,
  ClusterMemberUseClusterUnmergeError,
  LegacyClusterNotSupportedError,
  requireReason,
  ReasonRequiredError,
} from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: factsheetId } = await params;
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'unmerge');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const result = await unmergeFactsheet(familyDb, {
      factsheetId,
      reason,
      actorId: ctx.userId,
      threadId,
    });

    revalidateTag('persons', 'max');
    revalidateTag('tree-data', 'max');
    revalidateTag('dashboard-stats', 'max');
    revalidateTag('factsheets-list', 'max');
    revalidateTag(`factsheet-${factsheetId}`, 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    if (err instanceof FactsheetNotPromotedError) {
      return NextResponse.json({ error: 'not-promoted', message: err.message }, { status: 400 });
    }
    if (err instanceof PersonDirtyError) {
      return NextResponse.json({ error: 'dirty', message: err.message }, { status: 400 });
    }
    if (err instanceof ClusterMemberUseClusterUnmergeError) {
      return NextResponse.json({
        error: 'ClusterMemberUseClusterUnmerge',
        hint: `/api/research/factsheets/${factsheetId}/unmerge-cluster`,
        message: 'This factsheet was promoted as part of a cluster. Use unmerge-cluster to reverse the cluster promotion.',
      }, { status: 422 });
    }
    if (err instanceof LegacyClusterNotSupportedError) {
      return NextResponse.json({
        error: 'LegacyClusterNotSupported',
        message: 'This factsheet appears to be part of a legacy cluster (pre-Bundle-D promotion). Cluster operations on legacy clusters are not yet supported.',
      }, { status: 422 });
    }
    console.error('[factsheets/[id]/unmerge POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
