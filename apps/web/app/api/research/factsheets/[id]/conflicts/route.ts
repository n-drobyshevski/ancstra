import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { detectFactsheetConflicts, resolveFactsheetConflict } from '@ancstra/research';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;

    const conflicts = await detectFactsheetConflicts(familyDb, id);
    return NextResponse.json({ conflicts });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/conflicts GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const body = await request.json();

    if (!body.acceptedFactId || !body.rejectedFactIds?.length) {
      return NextResponse.json(
        { error: 'acceptedFactId and rejectedFactIds are required' },
        { status: 400 },
      );
    }

    await resolveFactsheetConflict(familyDb, body.acceptedFactId, body.rejectedFactIds);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/conflicts POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
