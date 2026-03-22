import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, matchCandidates } from '@ancstra/db';
import { eq } from 'drizzle-orm';

const VALID_STATUSES = ['accepted', 'rejected', 'maybe', 'pending'] as const;
type MatchStatus = typeof VALID_STATUSES[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { matchStatus } = body as { matchStatus: MatchStatus };

    if (!matchStatus || !VALID_STATUSES.includes(matchStatus)) {
      return NextResponse.json(
        { error: `Invalid matchStatus. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const db = createDb();

    const existing = db
      .select()
      .from(matchCandidates)
      .where(eq(matchCandidates.id, id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    db.update(matchCandidates)
      .set({
        matchStatus,
        reviewedAt: new Date().toISOString(),
      })
      .where(eq(matchCandidates.id, id))
      .run();

    const updated = db
      .select()
      .from(matchCandidates)
      .where(eq(matchCandidates.id, id))
      .get();

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[matching/hints PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
