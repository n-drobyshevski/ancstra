import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  getResearchItem,
  updateResearchItemStatus,
  updateResearchItemNotes,
  deleteResearchItem,
} from '@ancstra/research';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const item = getResearchItem(familyDb, id);

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

    if (body.status !== undefined) {
      const validStatuses = ['draft', 'promoted', 'dismissed'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: draft, promoted, dismissed' },
          { status: 400 }
        );
      }
      updateResearchItemStatus(familyDb, id, body.status);
    }

    if (body.notes !== undefined) {
      updateResearchItemNotes(familyDb, id, body.notes);
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

    deleteResearchItem(familyDb, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items/[id] DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
