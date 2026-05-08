import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, families, refreshSummary } from '@ancstra/db';
import { and, eq, isNull } from 'drizzle-orm';
import { createFamilySchema } from '@/lib/validation';
import { withAuth, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';
import { findOrCreateFamilyByPartners } from '@/lib/queries';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('family:create', request);

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

    // Idempotent dedup: returns existing family for an already-known pair, or
    // any family already listing the named partner for single-parent inserts.
    // Prevents the "create family" UI flow from minting a fresh row each call.
    const { familyId, created } = await findOrCreateFamilyByPartners(familyDb, {
      partner1Id: data.partner1Id ?? null,
      partner2Id: data.partner2Id ?? null,
      relationshipType: data.relationshipType ?? 'unknown',
    });

    const [familyRow] = await familyDb
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .all();

    if (created) {
      if (data.partner1Id) await refreshSummary(familyDb, data.partner1Id);
      if (data.partner2Id) await refreshSummary(familyDb, data.partner2Id);
      revalidateTag('tree-data', 'max');
      revalidateTag('persons', 'max');
      await logAndInvalidate(centralDb, ctx, {
        action: 'relationship_added',
        entityType: 'family',
        entityId: familyId,
        summary: 'Added a family relationship',
        metadata: { relationshipType: data.relationshipType },
      });
    }
    return NextResponse.json(familyRow, { status: created ? 201 : 200 });
  } catch (error) {
    return handleAuthError(error);
  }
}
