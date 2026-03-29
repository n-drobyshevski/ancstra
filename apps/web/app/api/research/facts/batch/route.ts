import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { batchCreateFacts } from '@ancstra/research';

export async function POST(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');

    const body = await request.json();

    if (!Array.isArray(body.facts) || body.facts.length === 0) {
      return NextResponse.json(
        { error: 'Validation failed: facts array is required and must not be empty' },
        { status: 400 },
      );
    }

    // Validate each fact has required fields
    for (const fact of body.facts) {
      if (!fact.factType || !fact.factValue) {
        return NextResponse.json(
          { error: 'Validation failed: each fact must have factType and factValue' },
          { status: 400 },
        );
      }
      if (!fact.personId && !fact.factsheetId) {
        return NextResponse.json(
          { error: 'Validation failed: each fact must have either personId or factsheetId' },
          { status: 400 },
        );
      }
    }

    const results = await batchCreateFacts(familyDb, body.facts);

    return NextResponse.json({ facts: results }, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[research/facts/batch POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
