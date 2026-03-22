import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb } from '@ancstra/db';
import {
  getResearchItem,
  tagPersonToItem,
  untagPersonFromItem,
} from '@ancstra/research';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.personId) {
    return NextResponse.json(
      { error: 'Validation failed: personId is required' },
      { status: 400 }
    );
  }

  const db = createDb();

  const existing = getResearchItem(db, id);
  if (!existing) {
    return NextResponse.json({ error: 'Research item not found' }, { status: 404 });
  }

  tagPersonToItem(db, id, body.personId);

  const updated = getResearchItem(db, id);
  return NextResponse.json(updated, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.personId) {
    return NextResponse.json(
      { error: 'Validation failed: personId is required' },
      { status: 400 }
    );
  }

  const db = createDb();

  const existing = getResearchItem(db, id);
  if (!existing) {
    return NextResponse.json({ error: 'Research item not found' }, { status: 404 });
  }

  untagPersonFromItem(db, id, body.personId);

  const updated = getResearchItem(db, id);
  return NextResponse.json(updated);
}
