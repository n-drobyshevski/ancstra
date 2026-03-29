import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  getResearchItem,
  updateResearchItemNotes,
  updateResearchItemContent,
  deleteResearchItem,
} from '@ancstra/research';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const item = await getResearchItem(familyDb, id);

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items/[id] GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const body = await request.json();

    const existing = getResearchItem(familyDb, id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (body.notes !== undefined) {
      await updateResearchItemNotes(familyDb, id, body.notes);
    }

    if (body.fullText !== undefined) {
      await updateResearchItemContent(familyDb, id, { fullText: body.fullText });
    }

    const updated = getResearchItem(familyDb, id);
    return NextResponse.json(updated);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items/[id] PATCH]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;

    const existing = getResearchItem(familyDb, id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await deleteResearchItem(familyDb, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items/[id] DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
