import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod/v3';
import { persons, addChildToFamily, refreshRelatedSummaries } from '@ancstra/db';
import { and, eq, isNull } from 'drizzle-orm';
import { addSibling } from '@/lib/queries';
import { withAuth, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';

const addSiblingSchema = z.object({
  siblingId: z.string().min(1, 'siblingId is required'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('family:create');

    const { id: personId } = await params;
    const body = await request.json();
    const parsed = addSiblingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { siblingId } = parsed.data;

    if (siblingId === personId) {
      return NextResponse.json(
        { error: 'Cannot link a person as their own sibling' },
        { status: 400 }
      );
    }

    const [target] = await familyDb
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
      .all();
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [sibling] = await familyDb
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, siblingId), isNull(persons.deletedAt)))
      .all();
    if (!sibling) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { familyId, alreadyLinked } = await addSibling(familyDb, personId, siblingId);

    if (alreadyLinked) {
      return NextResponse.json(
        { error: 'Already linked as sibling', familyId },
        { status: 409 }
      );
    }

    // Update closure table for both children (target may have been freshly
    // added to an unknown-parents family; siblings are always newly linked).
    await addChildToFamily(familyDb, familyId, personId);
    await addChildToFamily(familyDb, familyId, siblingId);
    await refreshRelatedSummaries(familyDb, siblingId);
    await refreshRelatedSummaries(familyDb, personId);

    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    await logAndInvalidate(centralDb, ctx, {
      action: 'relationship_added',
      entityType: 'family',
      entityId: familyId,
      summary: 'Added a sibling relationship',
    });

    return NextResponse.json({ familyId }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
