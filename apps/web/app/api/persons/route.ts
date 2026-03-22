import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, persons, personNames, events } from '@ancstra/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { createPersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createPersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();
  const now = new Date().toISOString();

  const personId = crypto.randomUUID();
  const nameId = crypto.randomUUID();

  // Drizzle + better-sqlite3 transactions are SYNCHRONOUS
  db.transaction((tx) => {
    tx.insert(persons)
      .values({
        id: personId,
        sex: data.sex,
        isLiving: data.isLiving,
        notes: data.notes ?? null,
        createdBy: session.user.id ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    tx.insert(personNames)
      .values({
        id: nameId,
        personId,
        givenName: data.givenName,
        surname: data.surname,
        nameType: 'birth',
        isPrimary: true,
        createdAt: now,
      })
      .run();

    if (data.birthDate || data.birthPlace) {
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          personId,
          eventType: 'birth',
          dateOriginal: data.birthDate ?? null,
          dateSort: data.birthDate ? parseDateToSort(data.birthDate) : null,
          placeText: data.birthPlace ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    if (data.deathDate || data.deathPlace) {
      tx.insert(events)
        .values({
          id: crypto.randomUUID(),
          personId,
          eventType: 'death',
          dateOriginal: data.deathDate ?? null,
          dateSort: data.deathDate ? parseDateToSort(data.deathDate) : null,
          placeText: data.deathPlace ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });

  return NextResponse.json(
    {
      id: personId,
      givenName: data.givenName,
      surname: data.surname,
      sex: data.sex,
      isLiving: data.isLiving,
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
  const offset = (page - 1) * pageSize;
  const q = searchParams.get('q');

  const db = createDb();

  const whereClause = q
    ? and(
        isNull(persons.deletedAt),
        sql`(${personNames.givenName} LIKE ${'%' + q + '%'} OR ${personNames.surname} LIKE ${'%' + q + '%'})`
      )
    : isNull(persons.deletedAt);

  const rows = db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
    })
    .from(persons)
    .innerJoin(
      personNames,
      sql`${personNames.personId} = ${persons.id} AND ${personNames.isPrimary} = 1`
    )
    .where(whereClause)
    .limit(pageSize)
    .offset(offset)
    .all();

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(persons);

  if (q) {
    countQuery.innerJoin(
      personNames,
      sql`${personNames.personId} = ${persons.id} AND ${personNames.isPrimary} = 1`
    );
  }

  const [{ count }] = countQuery
    .where(whereClause)
    .all();

  // Add birth/death dates from events
  const personIds = rows.map((r) => r.id);
  const birthDeathEvents =
    personIds.length > 0
      ? db
          .select({
            personId: events.personId,
            eventType: events.eventType,
            dateOriginal: events.dateOriginal,
          })
          .from(events)
          .where(
            sql`${events.personId} IN (${sql.join(
              personIds.map((id) => sql`${id}`),
              sql`, `
            )}) AND ${events.eventType} IN ('birth', 'death')`
          )
          .all()
      : [];

  const eventsByPerson = new Map<string, { birthDate?: string | null; deathDate?: string | null }>();
  for (const ev of birthDeathEvents) {
    if (!ev.personId) continue;
    const entry = eventsByPerson.get(ev.personId) ?? {};
    if (ev.eventType === 'birth') entry.birthDate = ev.dateOriginal;
    if (ev.eventType === 'death') entry.deathDate = ev.dateOriginal;
    eventsByPerson.set(ev.personId, entry);
  }

  const items = rows.map((r) => ({
    ...r,
    birthDate: eventsByPerson.get(r.id)?.birthDate ?? null,
    deathDate: eventsByPerson.get(r.id)?.deathDate ?? null,
  }));

  return NextResponse.json({ items, total: count, page, pageSize });
}
