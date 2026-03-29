import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  createFact,
  getFactsByPerson,
  getFactsByResearchItem,
} from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');
    const researchItemId = searchParams.get('researchItemId');

    if (!personId && !researchItemId) {
      return NextResponse.json(
        { error: 'Either personId or researchItemId query parameter is required' },
        { status: 400 }
      );
    }

    if (personId) {
      const facts = await getFactsByPerson(familyDb, personId);
      return NextResponse.json({ facts });
    }

    const facts = await getFactsByResearchItem(familyDb, researchItemId!);
    return NextResponse.json({ facts });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/facts GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');

    const body = await request.json();

    if (!body.factType || !body.factValue) {
      return NextResponse.json(
        { error: 'Validation failed: factType and factValue are required' },
        { status: 400 }
      );
    }

    if (!body.personId && !body.factsheetId) {
      return NextResponse.json(
        { error: 'Validation failed: either personId or factsheetId is required' },
        { status: 400 }
      );
    }

    const result = await createFact(familyDb, body);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/facts POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
