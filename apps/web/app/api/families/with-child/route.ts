import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, addChildToFamily, refreshRelatedSummaries, refreshSummary } from '@ancstra/db';
import { and, eq, isNull } from 'drizzle-orm';
import { withAuth, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';
import { linkChildToParent } from '@/lib/queries';
import { z } from 'zod/v3';

const schema = z.object({
  parentId: z.string().min(1),
  childId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('family:create', request);

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { parentId, childId } = parsed.data;

    // Validate both persons exist
    const [parent] = await familyDb
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, parentId), isNull(persons.deletedAt)))
      .all();
    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    const [child] = await familyDb
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, childId), isNull(persons.deletedAt)))
      .all();
    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Reuse an existing family for this parent if one already exists; only
    // mint a new families row when the parent has no prior family. Idempotent
    // on (parent, child) — re-dragging the same edge is a no-op.
    const { familyId, childLinked } = await linkChildToParent(familyDb, parentId, childId);

    if (childLinked) {
      // Post-transaction: update closure table and summaries
      await addChildToFamily(familyDb, familyId, childId);
      await refreshSummary(familyDb, parentId);
      await refreshRelatedSummaries(familyDb, childId);
    }

    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    await logAndInvalidate(centralDb, ctx, {
      action: 'relationship_added',
      entityType: 'family',
      entityId: familyId,
      summary: 'Created a parent-child relationship',
    });
    return NextResponse.json({ familyId }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
