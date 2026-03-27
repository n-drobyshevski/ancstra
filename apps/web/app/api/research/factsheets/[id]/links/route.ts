import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  getFactsheetLinks,
  createFactsheetLink,
  deleteFactsheetLink,
  suggestFactsheetLinks,
} from '@ancstra/research';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    if (searchParams.get('suggest') === 'true') {
      const suggestions = await suggestFactsheetLinks(familyDb, id);
      return NextResponse.json({ suggestions });
    }

    const links = await getFactsheetLinks(familyDb, id);
    return NextResponse.json({ links });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/links GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id: fromFactsheetId } = await params;
    const body = await request.json();

    if (!body.toFactsheetId || !body.relationshipType) {
      return NextResponse.json(
        { error: 'toFactsheetId and relationshipType are required' },
        { status: 400 },
      );
    }

    const result = await createFactsheetLink(familyDb, {
      fromFactsheetId,
      toFactsheetId: body.toFactsheetId,
      relationshipType: body.relationshipType,
      sourceFactId: body.sourceFactId,
      confidence: body.confidence,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/links POST]', err);
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

    if (!body.linkId) {
      return NextResponse.json({ error: 'linkId is required' }, { status: 400 });
    }

    await deleteFactsheetLink(familyDb, body.linkId);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[factsheets/[id]/links DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
