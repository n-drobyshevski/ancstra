import { NextResponse } from 'next/server';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  getResearchItem,
  tagPersonToItem,
  untagPersonFromItem,
} from '@ancstra/research';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const body = await request.json();

    if (!body.personId) {
      return NextResponse.json(
        { error: 'Validation failed: personId is required' },
        { status: 400 }
      );
    }

    const existing = getResearchItem(familyDb, id);
    if (!existing) {
      return NextResponse.json({ error: 'Research item not found' }, { status: 404 });
    }

    tagPersonToItem(familyDb, id, body.personId);

    const updated = getResearchItem(familyDb, id);
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items/[id]/persons POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('ai:research');
    const { id } = await params;
    const body = await request.json();

    if (!body.personId) {
      return NextResponse.json(
        { error: 'Validation failed: personId is required' },
        { status: 400 }
      );
    }

    const existing = getResearchItem(familyDb, id);
    if (!existing) {
      return NextResponse.json({ error: 'Research item not found' }, { status: 404 });
    }

    untagPersonFromItem(familyDb, id, body.personId);

    const updated = getResearchItem(familyDb, id);
    return NextResponse.json(updated);
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not an auth error */ }
    console.error('[research/items/[id]/persons DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
