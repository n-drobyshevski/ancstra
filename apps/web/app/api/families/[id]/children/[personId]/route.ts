import { NextResponse } from 'next/server';
import { children } from '@ancstra/db';
import { and, eq } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  try {
    const { familyDb } = await withAuth('family:edit');

    const { id: familyId, personId } = await params;

    const [existing] = familyDb
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, personId)))
      .all();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    familyDb.delete(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, personId)))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
