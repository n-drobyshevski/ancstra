import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { children, removeChildFromFamily, refreshRelatedSummaries } from '@ancstra/db';
import { and, eq } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { softDeleteFamilyIfEmpty } from '@/lib/queries';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  try {
    const { familyDb } = await withAuth('family:edit', request);

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

    // If the family is now an empty single-parent container, soft-delete it
    // so the dashboard count reflects only meaningful family records.
    await softDeleteFamilyIfEmpty(familyDb, familyId);

    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
