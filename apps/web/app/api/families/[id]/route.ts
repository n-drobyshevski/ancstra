import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, personNames, families, children, events, refreshSummary, type FamilyDatabase } from '@ancstra/db';
import { and, eq, isNull } from 'drizzle-orm';
import { updateFamilySchema } from '@/lib/validation';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

async function getPersonListItem(
  db: FamilyDatabase,
  personId: string,
) {
  const row = await db
    .select({ id: persons.id, sex: persons.sex, isLiving: persons.isLiving })
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .get();

  if (!row) return null;

  const name = await db
    .select({ givenName: personNames.givenName, surname: personNames.surname })
    .from(personNames)
    .where(and(eq(personNames.personId, personId), eq(personNames.isPrimary, true)))
    .get();

  const birthEvent = await db
    .select({ dateOriginal: events.dateOriginal })
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.eventType, 'birth')))
    .get();

  const deathEvent = await db
    .select({ dateOriginal: events.dateOriginal })
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.eventType, 'death')))
    .get();

  return {
    id: row.id,
    givenName: name?.givenName ?? '',
    surname: name?.surname ?? '',
    sex: row.sex,
    isLiving: row.isLiving,
    birthDate: birthEvent?.dateOriginal ?? null,
    deathDate: deathEvent?.dateOriginal ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('tree:view');
    const { id } = await params;

    const family = await familyDb
      .select()
      .from(families)
      .where(and(eq(families.id, id), isNull(families.deletedAt)))
      .get();

    if (!family) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Build partner info
    const partner1 = family.partner1Id ? await getPersonListItem(familyDb, family.partner1Id) : null;
    const partner2 = family.partner2Id ? await getPersonListItem(familyDb, family.partner2Id) : null;

    // Build children array
    const childRows = await familyDb
      .select({ personId: children.personId })
      .from(children)
      .where(eq(children.familyId, id))
      .all();

    const childList = (await Promise.all(
      childRows.map((cr) => getPersonListItem(familyDb, cr.personId))
    )).filter((c): c is NonNullable<typeof c> => c !== null);

    return NextResponse.json({
      ...family,
      partner1,
      partner2,
      children: childList,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('family:edit');

    const { id } = await params;
    const body = await request.json();
    const parsed = updateFamilySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const [existing] = await familyDb
      .select()
      .from(families)
      .where(and(eq(families.id, id), isNull(families.deletedAt)))
      .all();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: now };
    if (data.relationshipType !== undefined) updates.relationshipType = data.relationshipType;
    if (data.validationStatus !== undefined) updates.validationStatus = data.validationStatus;

    await familyDb.update(families).set(updates).where(eq(families.id, id)).run();

    const [updated] = await familyDb.select().from(families).where(eq(families.id, id)).all();
    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    return NextResponse.json(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { familyDb } = await withAuth('family:delete');

    const { id } = await params;

    const [existing] = await familyDb
      .select()
      .from(families)
      .where(and(eq(families.id, id), isNull(families.deletedAt)))
      .all();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Soft-delete family (children cascade via ON DELETE CASCADE won't fire for soft-delete,
    // so also delete child links explicitly)
    await familyDb.transaction(async (tx) => {
      await tx.delete(children).where(eq(children.familyId, id)).run();
      await tx.update(families)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(families.id, id))
        .run();
    });

    if (existing.partner1Id) await refreshSummary(familyDb, existing.partner1Id);
    if (existing.partner2Id) await refreshSummary(familyDb, existing.partner2Id);
    revalidateTag('tree-data', 'max');
    revalidateTag('persons', 'max');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
