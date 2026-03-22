import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import {
  createFact,
  getFactsByPerson,
  getFactsByResearchItem,
} from '@ancstra/research';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get('personId');
  const researchItemId = searchParams.get('researchItemId');

  if (!personId && !researchItemId) {
    return NextResponse.json(
      { error: 'Either personId or researchItemId query parameter is required' },
      { status: 400 }
    );
  }

  const db = createDb();

  if (personId) {
    const facts = getFactsByPerson(db, personId);
    return NextResponse.json({ facts });
  }

  const facts = getFactsByResearchItem(db, researchItemId!);
  return NextResponse.json({ facts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.personId || !body.factType || !body.factValue) {
    return NextResponse.json(
      { error: 'Validation failed: personId, factType, and factValue are required' },
      { status: 400 }
    );
  }

  const db = createDb();
  const result = createFact(db, body);

  return NextResponse.json(result, { status: 201 });
}
