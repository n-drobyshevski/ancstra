import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, treeLayouts } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { createLayoutSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createLayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // If this layout should be the default, unset all existing defaults first
  if (data.isDefault) {
    db.update(treeLayouts)
      .set({ isDefault: false })
      .where(eq(treeLayouts.isDefault, true))
      .run();
  }

  db.insert(treeLayouts)
    .values({
      id,
      name: data.name,
      layoutData: data.layoutData,
      isDefault: data.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const [layout] = db
    .select({
      id: treeLayouts.id,
      name: treeLayouts.name,
      isDefault: treeLayouts.isDefault,
      updatedAt: treeLayouts.updatedAt,
    })
    .from(treeLayouts)
    .where(eq(treeLayouts.id, id))
    .all();

  return NextResponse.json(layout, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createDb();

  const layouts = db
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
}
