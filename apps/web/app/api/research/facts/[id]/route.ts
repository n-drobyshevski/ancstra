import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { researchFacts } from '@ancstra/db';
import { updateFact, deleteFact } from '@ancstra/research';

function getFact(db: ReturnType<typeof createDb>, id: string) {
  const [fact] = db
    .select()
    .from(researchFacts)
    .where(eq(researchFacts.id, id))
    .all();
  return fact ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();
  const fact = getFact(db, id);

  if (!fact) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(fact);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = createDb();

  const existing = getFact(db, id);
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

  const updated = updateFact(db, id, {
    factValue: body.factValue,
    confidence: body.confidence,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();

  const existing = getFact(db, id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  deleteFact(db, id);
  return NextResponse.json({ success: true });
}
