import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, personNames, families, children, events, personSummary, refreshSummary, type FamilyDatabase } from '@ancstra/db';
import { and, eq, isNull, inArray, sql } from 'drizzle-orm';
import { updateFamilySchema } from '@/lib/validation';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

async function getPersonListItemsBatch(
  db: FamilyDatabase,
  personIds: string[],
) {
  if (personIds.length === 0) return new Map<string, { id: string; givenName: string; surname: string; sex: string; isLiving: boolean; birthDate: string | null; deathDate: string | null }>();

  const rows = await db.all<{
    person_id: string;
    given_name: string;
    surname: string;
    sex: string;
    is_living: number;
    birth_date: string | null;
    death_date: string | null;
  }>(sql`
    SELECT person_id, given_name, surname, sex, is_living, birth_date, death_date
    FROM person_summary
    WHERE person_id IN (${sql.join(personIds.map((id) => sql`${id}`), sql`, `)})
  `);

  const map = new Map<string, { id: string; givenName: string; surname: string; sex: string; isLiving: boolean; birthDate: string | null; deathDate: string | null }>();
  for (const r of rows) {
    map.set(r.person_id, {
      id: r.person_id,
      givenName: r.given_name,
      surname: r.surname,
      sex: r.sex,
      isLiving: Boolean(r.is_living),
      birthDate: r.birth_date,
      deathDate: r.death_date,
    });
  }
  return map;
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

    // Build children array
    const childRows = await familyDb
      .select({ personId: children.personId })
      .from(children)
      .where(eq(children.familyId, id))
      .all();

    // Batch-fetch all related persons in a single query
    const allIds = [
      ...(family.partner1Id ? [family.partner1Id] : []),
      ...(family.partner2Id ? [family.partner2Id] : []),
      ...childRows.map((cr) => cr.personId),
    ];
    const batchMap = await getPersonListItemsBatch(familyDb, allIds);

    const partner1 = family.partner1Id ? batchMap.get(family.partner1Id) ?? null : null;
    const partner2 = family.partner2Id ? batchMap.get(family.partner2Id) ?? null : null;
    const childList = childRows
      .map((cr) => batchMap.get(cr.personId))
      .filter((c): c is NonNullable<typeof c> => c !== null);

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
