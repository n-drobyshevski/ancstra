import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, treeLayouts } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { updateLayoutSchema } from '@/lib/validation';

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

  const [layout] = db
    .select()
    .from(treeLayouts)
    .where(eq(treeLayouts.id, id))
    .all();

  if (!layout) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(layout);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateLayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();
  const now = new Date().toISOString();

  const [existing] = db
    .select()
    .from(treeLayouts)
    .where(eq(treeLayouts.id, id))
    .all();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.layoutData !== undefined) updates.layoutData = data.layoutData;

  db.update(treeLayouts)
    .set(updates)
    .where(eq(treeLayouts.id, id))
    .run();

  const [updated] = db
    .select()
    .from(treeLayouts)
    .where(eq(treeLayouts.id, id))
    .all();

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

  const [existing] = db
    .select()
    .from(treeLayouts)
    .where(eq(treeLayouts.id, id))
    .all();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  db.delete(treeLayouts)
    .where(eq(treeLayouts.id, id))
    .run();

  return NextResponse.json({ success: true });
}
