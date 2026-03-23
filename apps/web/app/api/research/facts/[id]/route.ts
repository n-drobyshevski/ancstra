import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { eq } from 'drizzle-orm';
import { researchFacts, type FamilyDatabase } from '@ancstra/db';
import { updateFact, deleteFact } from '@ancstra/research';

async function getFact(db: FamilyDatabase, id: string) {
  const facts = await db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.id, id))
    .all();
  return facts[0] ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const fact = getFact(familyDb, id);

    if (!fact) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(fact);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/facts/[id] GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const body = await request.json();

    const existing = getFact(familyDb, id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (body.confidence !== undefined) {
      const validConfidences = ['high', 'medium', 'low', 'disputed'];
      if (!validConfidences.includes(body.confidence)) {
        return NextResponse.json(
          { error: 'Invalid confidence. Must be one of: high, medium, low, disputed' },
          { status: 400 }
        );
      }
    }

    const updated = updateFact(familyDb, id, {
      factValue: body.factValue,
      confidence: body.confidence,
    });

    return NextResponse.json(updated);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/facts/[id] PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;

    const existing = getFact(familyDb, id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    deleteFact(familyDb, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/facts/[id] DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
