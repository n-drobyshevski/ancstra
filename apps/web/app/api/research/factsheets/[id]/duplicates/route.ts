import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { checkDuplicates } from '@ancstra/research';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;

    const matches = await checkDuplicates(familyDb, id);
    return NextResponse.json({ matches });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/duplicates GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
