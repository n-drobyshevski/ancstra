import { NextResponse } from 'next/server';
import { sourceCitations } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('source:edit');

    const { id } = await params;

    const [existing] = await familyDb
      .select()
      .from(sourceCitations)
      .where(eq(sourceCitations.id, id))
      .all();
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await familyDb.delete(sourceCitations).where(eq(sourceCitations.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
