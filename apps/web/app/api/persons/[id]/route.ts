import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, persons, personNames, events } from '@ancstra/db';
import { eq, and, isNull } from 'drizzle-orm';
import { assemblePersonDetail } from '@/lib/queries';
import { updatePersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';

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
  const person = assemblePersonDetail(db, id);
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(person);
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
  const parsed = updatePersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();
  const now = new Date().toISOString();

  // Check person exists
  const [existing] = db
    .select()
    .from(persons)
    .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
    .all();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Transaction: update person + name + upsert events
  db.transaction((tx) => {
    // 1. Update persons table (only provided fields)
    const personUpdates: Record<string, unknown> = { updatedAt: now };
    if (data.sex !== undefined) personUpdates.sex = data.sex;
    if (data.isLiving !== undefined) personUpdates.isLiving = data.isLiving;
    if (data.notes !== undefined) personUpdates.notes = data.notes;
    tx.update(persons).set(personUpdates).where(eq(persons.id, id)).run();

    // 2. Update primary name if provided
    if (data.givenName || data.surname) {
      const nameUpdates: Record<string, unknown> = {};
      if (data.givenName) nameUpdates.givenName = data.givenName;
      if (data.surname) nameUpdates.surname = data.surname;
      tx.update(personNames)
        .set(nameUpdates)
        .where(
          and(eq(personNames.personId, id), eq(personNames.isPrimary, true))
        )
        .run();
    }

    // 3. Upsert birth event
    if (data.birthDate !== undefined || data.birthPlace !== undefined) {
      const [existingBirth] = tx
        .select()
        .from(events)
        .where(and(eq(events.personId, id), eq(events.eventType, 'birth')))
        .all();
      if (existingBirth) {
        tx.update(events)
          .set({
            dateOriginal: data.birthDate ?? existingBirth.dateOriginal,
            dateSort: data.birthDate
              ? parseDateToSort(data.birthDate)
              : existingBirth.dateSort,
            placeText: data.birthPlace ?? existingBirth.placeText,
            updatedAt: now,
          })
          .where(eq(events.id, existingBirth.id))
          .run();
      } else {
        tx.insert(events)
          .values({
            id: crypto.randomUUID(),
            personId: id,
            eventType: 'birth',
            dateOriginal: data.birthDate ?? null,
            dateSort: data.birthDate ? parseDateToSort(data.birthDate) : null,
            placeText: data.birthPlace ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }

    // 4. Upsert death event
    if (data.deathDate !== undefined || data.deathPlace !== undefined) {
      const [existingDeath] = tx
        .select()
        .from(events)
        .where(and(eq(events.personId, id), eq(events.eventType, 'death')))
        .all();
      if (existingDeath) {
        tx.update(events)
          .set({
            dateOriginal: data.deathDate ?? existingDeath.dateOriginal,
            dateSort: data.deathDate
              ? parseDateToSort(data.deathDate)
              : existingDeath.dateSort,
            placeText: data.deathPlace ?? existingDeath.placeText,
            updatedAt: now,
          })
          .where(eq(events.id, existingDeath.id))
          .run();
      } else {
        tx.insert(events)
          .values({
            id: crypto.randomUUID(),
            personId: id,
            eventType: 'death',
            dateOriginal: data.deathDate ?? null,
            dateSort: data.deathDate ? parseDateToSort(data.deathDate) : null,
            placeText: data.deathPlace ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    }
  });

  const updated = assemblePersonDetail(db, id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();

  const [existing] = db
    .select()
    .from(persons)
    .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
    .all();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  db.update(persons)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(persons.id, id))
    .run();

  return NextResponse.json({ success: true });
}
