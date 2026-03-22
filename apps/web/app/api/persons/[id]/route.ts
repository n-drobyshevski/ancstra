import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, persons, personNames, events } from '@ancstra/db';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import type { Person } from '@ancstra/shared';

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

  const [person] = db
    .select()
    .from(persons)
    .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
    .all();

  if (!person) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [primaryName] = db
    .select()
    .from(personNames)
    .where(and(eq(personNames.personId, id), eq(personNames.isPrimary, true)))
    .all();

  const personEvents = db
    .select()
    .from(events)
    .where(
      and(
        eq(events.personId, id),
        inArray(events.eventType, ['birth', 'death'])
      )
    )
    .all();

  const birthEvent = personEvents.find((e) => e.eventType === 'birth');
  const deathEvent = personEvents.find((e) => e.eventType === 'death');

  const assembled: Person = {
    id: person.id,
    sex: person.sex,
    isLiving: person.isLiving,
    privacyLevel: person.privacyLevel,
    notes: person.notes,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
    givenName: primaryName?.givenName ?? '',
    surname: primaryName?.surname ?? '',
    prefix: primaryName?.prefix,
    suffix: primaryName?.suffix,
    birthDate: birthEvent?.dateOriginal,
    birthPlace: birthEvent?.placeText,
    deathDate: deathEvent?.dateOriginal,
    deathPlace: deathEvent?.placeText,
  };

  return NextResponse.json(assembled);
}
