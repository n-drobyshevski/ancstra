import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
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
    const reason = requireReason(body, 'children-dispute');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);
    const result = await disputeFamilyRow(familyDb, {
      target: 'children', rowId: id, reason, actorId: ctx.userId, threadId,
    });
    // Helper also revalidates these; route-level redundancy is intentional so the
    // static AST guard (inbox-revalidate-tag.test.ts) sees the discipline at the
    // route boundary. revalidateTag is idempotent.
    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    revalidateTag('inbox-count', 'max');
    return result;
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    console.error('[children/[id]/dispute POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
