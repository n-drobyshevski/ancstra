import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { getPersonsTouchedByThread } from '@ancstra/research';

/**
 * GET /api/research/threads/:id/persons
 * Returns the union of person ids "touched" by this thread:
 *  - persons promoted from factsheets that this thread created
 *  - persons referenced by any of the thread's events
 * Used by the tree-canvas overlay to highlight/dim nodes.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyDb } = await withAuth('ai:research', request);
    const { id } = await params;
    const personIds = await getPersonsTouchedByThread(familyDb, id);
    return NextResponse.json({ personIds });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[thread persons GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
