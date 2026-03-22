import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();
  const item = getResearchItem(db, id);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const db = createDb();

  const existing = getResearchItem(db, id);
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
    updateResearchItemStatus(db, id, body.status);
  }

  if (body.notes !== undefined) {
    updateResearchItemNotes(db, id, body.notes);
  }

  const updated = getResearchItem(db, id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();

  const existing = getResearchItem(db, id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  deleteResearchItem(db, id);
  return NextResponse.json({ success: true });
}
