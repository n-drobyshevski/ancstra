import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { promoteSingleFactsheet, promoteFactsheetCluster } from '@ancstra/research';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research');
    const { id: factsheetId } = await params;
    const body = await request.json();

    // Cluster promotion
    if (body.cluster === true) {
      const result = await promoteFactsheetCluster(familyDb, factsheetId, ctx.userId);
      revalidateTag('persons', 'max');
      revalidateTag('tree-data', 'max');
      revalidateTag('dashboard-stats', 'max');
      revalidateTag('factsheets-list', 'max');
      revalidateTag('factsheet-count', 'max');
      revalidateTag('factsheets', 'max');
      return NextResponse.json(result);
    }

    // Single promotion
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
    });

    revalidateTag('persons', 'max');
    revalidateTag('tree-data', 'max');
    revalidateTag('dashboard-stats', 'max');
    revalidateTag('factsheets-list', 'max');
    revalidateTag(`factsheet-${factsheetId}`, 'max');
    revalidateTag('factsheet-count', 'max');
    return NextResponse.json(result);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/promote POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
