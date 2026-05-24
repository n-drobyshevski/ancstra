import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { sql } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { logReverseEvent, requireReason, ReasonRequiredError } from '@ancstra/research';
import { getActiveThreadIdFromCookies } from '@/lib/research/active-thread-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personId: string; eventId: string }> },
) {
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);
    const { personId, eventId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'event-dispute');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const events = await familyDb.all<{ contested: number }>(sql`
      SELECT contested FROM events WHERE id = ${eventId} AND person_id = ${personId}
    `);
    const ev = events[0];
    if (!ev) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    if (ev.contested === 1) {
      return NextResponse.json({ error: 'already-contested' }, { status: 400 });
    }

    const now = new Date().toISOString();
    await familyDb.run(sql`BEGIN IMMEDIATE`);
    try {
      await familyDb.run(sql`
        UPDATE events SET contested = 1, updated_at = ${now} WHERE id = ${eventId}
      `);
      await logReverseEvent({
        db: familyDb,
        eventType: 'gedcom_disputed',
        reason,
        actorId: ctx.userId,
        threadId,
        personId,
        payload: { target: 'events', rowId: eventId },
      });
      await familyDb.run(sql`COMMIT`);
    } catch (err) {
      await familyDb.run(sql`ROLLBACK`);
      throw err;
    }

    revalidateTag('persons', 'max');
    revalidateTag(`person-${personId}`, 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    console.error('[persons/[personId]/events/[eventId]/dispute POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
