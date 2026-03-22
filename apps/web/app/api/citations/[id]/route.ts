import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, sourceCitations } from '@ancstra/db';
import { eq } from 'drizzle-orm';

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
    .from(sourceCitations)
    .where(eq(sourceCitations.id, id))
    .all();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  db.delete(sourceCitations).where(eq(sourceCitations.id, id)).run();

  return NextResponse.json({ success: true });
}
