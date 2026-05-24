import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { requireReason, ReasonRequiredError } from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';
import { disputeFamilyRow } from '@/lib/research/dispute-family-row';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'families-dispute');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);
    return await disputeFamilyRow(familyDb, {
      target: 'families', rowId: id, reason, actorId: ctx.userId, threadId,
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    console.error('[families/[id]/dispute POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
