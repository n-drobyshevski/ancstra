import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, persons, personNames, families, children, events } from '@ancstra/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { updateFamilySchema } from '@/lib/validation';

function getPersonListItem(
  db: ReturnType<typeof createDb>,
  personId: string,
) {
  const row = db
    .select({ id: persons.id, sex: persons.sex, isLiving: persons.isLiving })
    .from(persons)
    .where(and(eq(persons.id, personId), isNull(persons.deletedAt)))
    .get();

  if (!row) return null;

  const name = db
    .select({ givenName: personNames.givenName, surname: personNames.surname })
    .from(personNames)
    .where(and(eq(personNames.personId, personId), eq(personNames.isPrimary, true)))
    .get();

  const birthEvent = db
    .select({ dateOriginal: events.dateOriginal })
    .from(events)
    .where(and(eq(events.personId, personId), eq(events.eventType, 'birth')))
    .get();

  const deathEvent = db
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();

  const family = db
    .select()
    .from(families)
    .where(and(eq(families.id, id), isNull(families.deletedAt)))
    .get();

  if (!family) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Build partner info
  const partner1 = family.partner1Id ? getPersonListItem(db, family.partner1Id) : null;
  const partner2 = family.partner2Id ? getPersonListItem(db, family.partner2Id) : null;

  // Build children array
  const childRows = db
    .select({ personId: children.personId })
    .from(children)
    .where(eq(children.familyId, id))
    .all();

  const childList = childRows
    .map((cr) => getPersonListItem(db, cr.personId))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return NextResponse.json({
    ...family,
    partner1,
    partner2,
    children: childList,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const db = createDb();
  const now = new Date().toISOString();

  const [existing] = db
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

  db.update(families).set(updates).where(eq(families.id, id)).run();

  const [updated] = db.select().from(families).where(eq(families.id, id)).all();
  return NextResponse.json(updated);
}
