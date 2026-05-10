import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getThreadsForPerson } from '@ancstra/research';

/**
 * GET /api/persons/:id/threads
 * Returns all research threads that have "touched" the given person, ordered
 * by lastTouchedAt DESC. Used by the right-click "Show threads that touched
 * this person" modal.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;
    const threads = await getThreadsForPerson(familyDb, id);
    return NextResponse.json({ threads });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[person threads GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
