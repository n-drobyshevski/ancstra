import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, treeLayouts } from '@ancstra/db';
import { eq } from 'drizzle-orm';

export async function PUT(
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

  db.transaction((tx) => {
    tx.update(treeLayouts)
      .set({ isDefault: false })
      .where(eq(treeLayouts.isDefault, true))
      .run();

    tx.update(treeLayouts)
      .set({ isDefault: true })
      .where(eq(treeLayouts.id, id))
      .run();
  });

  return NextResponse.json({ success: true });
}
