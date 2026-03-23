import { NextResponse } from 'next/server';
import { treeLayouts } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function PUT(
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

    await familyDb.transaction(async (tx) => {
      await tx.update(treeLayouts)
        .set({ isDefault: false })
        .where(eq(treeLayouts.isDefault, true))
        .run();

      await tx.update(treeLayouts)
        .set({ isDefault: true })
        .where(eq(treeLayouts.id, id))
        .run();
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
