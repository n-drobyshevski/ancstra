import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { resolveConflict } from '@ancstra/research';

export async function POST(request: Request) {
  try {
    const { familyDb } = await withAuth('ai:research');

    const body = await request.json();
    const { winnerFactId, loserFactId } = body;

    if (!winnerFactId || !loserFactId) {
      return NextResponse.json(
        { error: 'Validation failed: winnerFactId and loserFactId are required' },
        { status: 400 },
      );
    }

    resolveConflict(familyDb, winnerFactId, loserFactId);

    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/conflicts/resolve POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
