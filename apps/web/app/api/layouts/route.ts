import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { treeLayouts } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { createLayoutSchema } from '@/lib/validation';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function POST(request: Request) {
  try {
    const { familyDb } = await withAuth('person:edit');

    const body = await request.json();
    const parsed = createLayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // If this layout should be the default, unset all existing defaults first
    if (data.isDefault) {
      await familyDb.update(treeLayouts)
        .set({ isDefault: false })
        .where(eq(treeLayouts.isDefault, true))
        .run();
    }

    await familyDb.insert(treeLayouts)
      .values({
        id,
        name: data.name,
        layoutData: data.layoutData,
        isDefault: data.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const [layout] = await familyDb
      .select({
        id: treeLayouts.id,
        name: treeLayouts.name,
        isDefault: treeLayouts.isDefault,
        updatedAt: treeLayouts.updatedAt,
      })
      .from(treeLayouts)
      .where(eq(treeLayouts.id, id))
      .all();

    revalidateTag('tree-layouts', 'max');

    return NextResponse.json(layout, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function GET() {
  try {
    const { familyDb } = await withAuth('tree:view');

    const layouts = await familyDb
      .select({
        id: treeLayouts.id,
        name: treeLayouts.name,
        isDefault: treeLayouts.isDefault,
        updatedAt: treeLayouts.updatedAt,
      })
      .from(treeLayouts)
      .orderBy(treeLayouts.name)
      .all();

    return NextResponse.json({ layouts });
  } catch (error) {
    return handleAuthError(error);
  }
}
