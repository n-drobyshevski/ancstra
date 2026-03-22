import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { matchCandidates } from '@ancstra/db';
import { eq } from 'drizzle-orm';

const VALID_STATUSES = ['accepted', 'rejected', 'maybe', 'pending'] as const;
type MatchStatus = typeof VALID_STATUSES[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('relationship:validate');

    const { id } = await params;
    const body = await request.json();
    const { matchStatus } = body as { matchStatus: MatchStatus };

    if (!matchStatus || !VALID_STATUSES.includes(matchStatus)) {
      return NextResponse.json(
        { error: `Invalid matchStatus. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const existing = familyDb
      .select()
      .from(matchCandidates)
      .where(eq(matchCandidates.id, id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    familyDb.update(matchCandidates)
      .set({
        matchStatus,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(matchCandidates.id, id))
      .run();

    const updated = familyDb
      .select()
      .from(matchCandidates)
      .where(eq(matchCandidates.id, id))
      .get();

    return NextResponse.json(updated);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[matching/hints PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
