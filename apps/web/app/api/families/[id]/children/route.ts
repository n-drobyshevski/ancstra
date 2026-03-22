import { NextResponse } from 'next/server';
import { persons, families, children } from '@ancstra/db';
import { and, eq, isNull } from 'drizzle-orm';
import { addChildSchema } from '@/lib/validation';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('family:edit');

    const { id: familyId } = await params;
    const body = await request.json();
    const parsed = addChildSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check family exists and not deleted
    const [family] = await familyDb
      .select({ id: families.id })
      .from(families)
      .where(and(eq(families.id, familyId), isNull(families.deletedAt)))
      .all();
    if (!family) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check person exists and not deleted
    const [person] = await familyDb
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, data.personId), isNull(persons.deletedAt)))
      .all();
    if (!person) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check no duplicate link
    const [existing] = await familyDb
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.familyId, familyId), eq(children.personId, data.personId)))
      .all();
    if (existing) {
      return NextResponse.json(
        { error: 'Child already linked to this family' },
        { status: 409 }
      );
    }

    await familyDb.insert(children)
      .values({
        id: crypto.randomUUID(),
        familyId,
        personId: data.personId,
        childOrder: data.childOrder ?? null,
        relationshipToParent1: data.relationshipToParent1 ?? 'biological',
        relationshipToParent2: data.relationshipToParent2 ?? 'biological',
        validationStatus: 'confirmed',
        createdAt: new Date().toISOString(),
      })
      .run();

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
