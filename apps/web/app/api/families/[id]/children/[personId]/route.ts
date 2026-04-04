import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { children, removeChildFromFamily, refreshRelatedSummaries } from '@ancstra/db';
import { and, eq } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  try {
    const { familyDb } = await withAuth('family:edit');

    const { id: familyId, personId } = await params;

    const [existing] = await familyDb
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, personId)))
      .all();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await familyDb.delete(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, personId)))
      .run();

    // Update closure table and person summaries
    await removeChildFromFamily(familyDb, familyId, personId);
    await refreshRelatedSummaries(familyDb, personId);

    revalidateTag('tree-data');
    revalidateTag('persons');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
