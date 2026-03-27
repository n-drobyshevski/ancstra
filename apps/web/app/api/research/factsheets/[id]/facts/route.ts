import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { assignFactToFactsheet, removeFactFromFactsheet } from '@ancstra/research';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id: factsheetId } = await params;
    const body = await request.json();

    if (!body.factId) {
      return NextResponse.json({ error: 'factId is required' }, { status: 400 });
    }

    await assignFactToFactsheet(familyDb, body.factId, factsheetId);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/facts POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const body = await request.json();

    if (!body.factId) {
      return NextResponse.json({ error: 'factId is required' }, { status: 400 });
    }

    await removeFactFromFactsheet(familyDb, body.factId);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/facts DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
