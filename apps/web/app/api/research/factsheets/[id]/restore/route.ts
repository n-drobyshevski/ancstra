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
    const { id: factsheetId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'restore');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const fs = await familyDb.all<{ status: string }>(sql`
      SELECT status FROM factsheets WHERE id = ${factsheetId}
    `);
    if (!fs[0]) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    if (fs[0].status !== 'dismissed') {
      return NextResponse.json(
        { error: 'not-dismissed', message: `Factsheet ${factsheetId} is not dismissed (status=${fs[0].status})` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    await familyDb.run(sql`BEGIN IMMEDIATE`);
    try {
      await familyDb.run(sql`
        UPDATE factsheets SET status = 'draft', updated_at = ${now} WHERE id = ${factsheetId}
      `);
      await logReverseEvent({
        db: familyDb,
        eventType: 'factsheet_restored',
        reason,
        actorId: ctx.userId,
        threadId,
        factsheetId,
      });
      await familyDb.run(sql`COMMIT`);
    } catch (err) {
      await familyDb.run(sql`ROLLBACK`);
      throw err;
    }

    revalidateTag('factsheets-list', 'max');
    revalidateTag(`factsheet-${factsheetId}`, 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    console.error('[factsheets/[id]/restore POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
