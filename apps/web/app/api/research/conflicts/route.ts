import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { detectConflicts } from '@ancstra/research';

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research', request);

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');

    if (!personId) {
      return NextResponse.json(
        { error: 'personId query parameter is required' },
        { status: 400 },
      );
    }

    const conflicts = await detectConflicts(familyDb, personId);

    return NextResponse.json({ conflicts });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/conflicts GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
