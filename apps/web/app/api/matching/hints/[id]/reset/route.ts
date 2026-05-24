import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { logReverseEvent, requireReason, ReasonRequiredError } from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { id: hintId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'hint-reset');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const hints = await familyDb.all<{ match_status: string; person_id: string }>(sql`
      SELECT match_status, person_id FROM match_candidates WHERE id = ${hintId}
    `);
    const hint = hints[0];
    if (!hint) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    if (hint.match_status === 'pending') {
      return NextResponse.json({ error: 'already-pending' }, { status: 400 });
    }

    await familyDb.run(sql`BEGIN IMMEDIATE`);
    try {
      await familyDb.run(sql`
        UPDATE match_candidates SET match_status = 'pending', reviewed_at = NULL WHERE id = ${hintId}
      `);
      await logReverseEvent({
        db: familyDb,
        eventType: 'hint_reset',
        reason,
        actorId: ctx.userId,
        threadId,
        personId: hint.person_id,
        payload: { matchCandidateId: hintId },
      });
      await familyDb.run(sql`COMMIT`);
    } catch (err) {
      await familyDb.run(sql`ROLLBACK`);
      throw err;
    }

    revalidateTag(`hints-person-${hint.person_id}`, 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    console.error('[matching/hints/[id]/reset POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
