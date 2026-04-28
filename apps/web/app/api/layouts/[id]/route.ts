import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { treeLayouts } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { updateLayoutSchema } from '@/lib/validation';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('tree:view');
    const { id } = await params;

    const [layout] = await familyDb
      .select()
      .from(treeLayouts)
      .where(eq(treeLayouts.id, id))
      .all();

    if (!layout) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(layout);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('person:edit');

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
    const now = new Date().toISOString();

    const [existing] = await familyDb
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

    await familyDb.update(treeLayouts)
      .set(updates)
      .where(eq(treeLayouts.id, id))
      .run();

    const [updated] = await familyDb
      .select()
      .from(treeLayouts)
      .where(eq(treeLayouts.id, id))
      .all();

    revalidateTag('tree-layouts', 'max');

    return NextResponse.json(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('person:edit');

    const { id } = await params;

    const [existing] = await familyDb
      .select()
      .from(treeLayouts)
      .where(eq(treeLayouts.id, id))
      .all();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await familyDb.delete(treeLayouts)
      .where(eq(treeLayouts.id, id))
      .run();

    revalidateTag('tree-layouts', 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
