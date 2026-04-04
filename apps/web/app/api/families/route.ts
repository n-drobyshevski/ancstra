import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, families, refreshSummary } from '@ancstra/db';
import { and, eq, or, isNull } from 'drizzle-orm';
import { createFamilySchema } from '@/lib/validation';
import { withAuth, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('family:create');

    const body = await request.json();
    const parsed = createFamilySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check that provided person(s) exist and aren't soft-deleted
    if (data.partner1Id) {
      const [p1] = await familyDb
        .select({ id: persons.id })
        .from(persons)
        .where(and(eq(persons.id, data.partner1Id), isNull(persons.deletedAt)))
        .all();
      if (!p1) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    if (data.partner2Id) {
      const [p2] = await familyDb
        .select({ id: persons.id })
        .from(persons)
        .where(and(eq(persons.id, data.partner2Id), isNull(persons.deletedAt)))
        .all();
      if (!p2) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    // Check no duplicate non-deleted family for this pair (both directions)
    if (data.partner1Id && data.partner2Id) {
      const [existing] = await familyDb
        .select({ id: families.id })
        .from(families)
        .where(
          and(
            isNull(families.deletedAt),
            or(
              and(
                eq(families.partner1Id, data.partner1Id),
                eq(families.partner2Id, data.partner2Id)
              ),
              and(
                eq(families.partner1Id, data.partner2Id),
                eq(families.partner2Id, data.partner1Id)
              )
            )
          )
        )
        .all();
      if (existing) {
        return NextResponse.json(
          { error: 'Family already exists for this pair' },
          { status: 409 }
        );
      }
    }

    const now = new Date().toISOString();
    const familyId = crypto.randomUUID();

    await familyDb.insert(families)
      .values({
        id: familyId,
        partner1Id: data.partner1Id ?? null,
        partner2Id: data.partner2Id ?? null,
        relationshipType: data.relationshipType ?? 'unknown',
        validationStatus: 'confirmed',
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const [created] = await familyDb
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .all();

    if (data.partner1Id) await refreshSummary(familyDb, data.partner1Id);
    if (data.partner2Id) await refreshSummary(familyDb, data.partner2Id);
    revalidateTag('tree-data');
    revalidateTag('persons');
    await logAndInvalidate(centralDb, ctx, {
      action: 'relationship_added',
      entityType: 'family',
      entityId: familyId,
      summary: 'Added a family relationship',
      metadata: { relationshipType: data.relationshipType },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
