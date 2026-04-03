import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, families, children, addChildToFamily, refreshRelatedSummaries, refreshSummary } from '@ancstra/db';
import { and, eq, isNull } from 'drizzle-orm';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { z } from 'zod/v3';

const schema = z.object({
  parentId: z.string().min(1),
  childId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { familyDb } = await withAuth('family:create');

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

    const now = new Date().toISOString();
    const familyId = crypto.randomUUID();
    const childLinkId = crypto.randomUUID();

    // Atomic: create family + link child in a single transaction
    await familyDb.transaction(async (tx) => {
      await tx.insert(families)
        .values({
          id: familyId,
          partner1Id: parentId,
          partner2Id: null,
          relationshipType: 'unknown',
          validationStatus: 'confirmed',
          createdAt: now,
          updatedAt: now,
        })
        .run();

      await tx.insert(children)
        .values({
          id: childLinkId,
          familyId,
          personId: childId,
          childOrder: null,
          relationshipToParent1: 'biological',
          relationshipToParent2: 'biological',
          validationStatus: 'confirmed',
          createdAt: now,
        })
        .run();
    });

    // Post-transaction: update closure table and summaries
    await addChildToFamily(familyDb, familyId, childId);
    await refreshSummary(familyDb, parentId);
    await refreshRelatedSummaries(familyDb, childId);

    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    return NextResponse.json({ familyId }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
