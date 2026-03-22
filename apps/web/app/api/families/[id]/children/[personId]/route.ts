import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, children } from '@ancstra/db';
import { and, eq } from 'drizzle-orm';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: familyId, personId } = await params;
  const db = createDb();

  const [existing] = db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.familyId, familyId), eq(children.personId, personId)))
    .all();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  db.delete(children)
    .where(and(eq(children.familyId, familyId), eq(children.personId, personId)))
    .run();

  return NextResponse.json({ success: true });
}
