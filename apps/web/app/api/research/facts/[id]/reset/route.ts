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
    const { id: factId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = requireReason(body, 'fact-reset');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const facts = await familyDb.all<{
      accepted: number | null;
      factsheet_id: string | null;
      person_id: string | null;
      fs_status: string | null;
    }>(sql`
      SELECT rf.accepted, rf.factsheet_id, rf.person_id, fs.status AS fs_status
      FROM research_facts rf
      LEFT JOIN factsheets fs ON fs.id = rf.factsheet_id
      WHERE rf.id = ${factId}
    `);
    const fact = facts[0];
    if (!fact) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    if (fact.accepted === null || fact.accepted === undefined) {
      return NextResponse.json({ error: 'already-unresolved' }, { status: 400 });
    }
    if (fact.fs_status === 'promoted') {
      return NextResponse.json(
        { error: 'parent-factsheet-promoted', message: 'Unmerge the factsheet first to alter accepted facts.' },
        { status: 400 },
      );
    }

    const eventType = fact.accepted === 1 ? 'fact_unaccepted' : 'fact_unrejected';
    const now = new Date().toISOString();

    await familyDb.run(sql`BEGIN IMMEDIATE`);
    try {
      await familyDb.run(sql`
        UPDATE research_facts SET accepted = NULL, updated_at = ${now} WHERE id = ${factId}
      `);
      await logReverseEvent({
        db: familyDb,
        eventType,
        reason,
        actorId: ctx.userId,
        threadId,
        researchFactId: factId,
        factsheetId: fact.factsheet_id ?? null,
        personId: fact.person_id ?? null,
      });
      await familyDb.run(sql`COMMIT`);
    } catch (err) {
      await familyDb.run(sql`ROLLBACK`);
      throw err;
    }

    revalidateTag('factsheets-list', 'max');
    if (fact.factsheet_id) revalidateTag(`factsheet-${fact.factsheet_id}`, 'max');
    revalidateTag('factsheet-count', 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    console.error('[research/facts/[id]/reset POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
