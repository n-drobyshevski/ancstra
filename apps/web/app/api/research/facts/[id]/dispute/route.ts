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
    const reason = requireReason(body, 'fact-dispute');
    const threadId = await getActiveThreadIdFromCookies(ctx.familyId);

    const facts = await familyDb.all<{
      contested: number;
      confidence: string;
      factsheet_id: string | null;
      person_id: string | null;
    }>(sql`
      SELECT contested, confidence, factsheet_id, person_id
      FROM research_facts WHERE id = ${factId}
    `);
    const fact = facts[0];
    if (!fact) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    if (fact.contested === 1) {
      return NextResponse.json({ error: 'already-contested' }, { status: 400 });
    }
    if (fact.confidence === 'unknown') {
      return NextResponse.json(
        { error: 'confidence-unknown', message: 'Cannot dispute a fact with unknown confidence (already low signal).' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    await familyDb.run(sql`BEGIN IMMEDIATE`);
    try {
      await familyDb.run(sql`
        UPDATE research_facts SET contested = 1, updated_at = ${now} WHERE id = ${factId}
      `);
      await logReverseEvent({
        db: familyDb,
        eventType: 'gedcom_disputed',
        reason,
        actorId: ctx.userId,
        threadId,
        researchFactId: factId,
        factsheetId: fact.factsheet_id ?? null,
        personId: fact.person_id ?? null,
        payload: { target: 'research_facts', rowId: factId },
      });
      await familyDb.run(sql`COMMIT`);
    } catch (err) {
      await familyDb.run(sql`ROLLBACK`);
      throw err;
    }

    revalidateTag('factsheets-list', 'max');
    if (fact.factsheet_id) revalidateTag(`factsheet-${fact.factsheet_id}`, 'max');
    revalidateTag('inbox-count', 'max');

    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    if (err instanceof ReasonRequiredError) {
      return NextResponse.json({ error: 'reason-required', message: err.message }, { status: 400 });
    }
    console.error('[research/facts/[id]/dispute POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
