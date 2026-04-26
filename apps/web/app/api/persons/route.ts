import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, personNames, events, refreshSummary } from '@ancstra/db';
import { and, isNull, sql } from 'drizzle-orm';
import { createPersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { searchPersonsFts } from '@/lib/queries';
import { withAuth, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';
import { queryPersonExtras } from '@/lib/queries/person-extras';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('person:create');

    const body = await request.json();
    const parsed = createPersonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const personId = crypto.randomUUID();
    const nameId = crypto.randomUUID();

    await familyDb.transaction(async (tx) => {
      await tx.insert(persons)
        .values({
          id: personId,
          sex: data.sex,
          isLiving: data.isLiving,
          notes: data.notes ?? null,
          createdBy: ctx.userId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      await tx.insert(personNames)
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
        await tx.insert(events)
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
        await tx.insert(events)
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

    await refreshSummary(familyDb, personId);
    revalidateTag('persons', 'max');
    revalidateTag('persons-list', 'max');
    revalidateTag('tree-data', 'max');
    revalidateTag('dashboard-stats', 'max');
    await logAndInvalidate(centralDb, ctx, {
      action: 'person_added',
      entityType: 'person',
      entityId: personId,
      summary: `Added ${data.givenName} ${data.surname}`,
      metadata: { sex: data.sex, isLiving: data.isLiving },
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
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('tree:view');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const offset = (page - 1) * pageSize;
    const q = searchParams.get('q');

    let baseItems: Array<{
      id: string;
      sex: 'M' | 'F' | 'U';
      isLiving: boolean;
      givenName: string;
      surname: string;
      birthDate?: string | null;
      deathDate?: string | null;
    }>;
    let total: number;

    if (q) {
      const allResults = await searchPersonsFts(familyDb, q, 1000);
      total = allResults.length;
      baseItems = allResults.slice(offset, offset + pageSize);
    } else {
      const whereClause = isNull(persons.deletedAt);

      const rows = await familyDb
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
          sql`${personNames.personId} = ${persons.id} AND ${personNames.isPrimary} = 1`,
        )
        .where(whereClause)
        .limit(pageSize)
        .offset(offset)
        .all();

      const [{ count }] = await familyDb
        .select({ count: sql<number>`count(*)` })
        .from(persons)
        .where(whereClause)
        .all();
      total = count;

      const personIds = rows.map((r) => r.id);
      const birthDeathEvents =
        personIds.length > 0
          ? await familyDb
              .select({
                personId: events.personId,
                eventType: events.eventType,
                dateOriginal: events.dateOriginal,
              })
              .from(events)
              .where(
                sql`${events.personId} IN (${sql.join(
                  personIds.map((id) => sql`${id}`),
                  sql`, `,
                )}) AND ${events.eventType} IN ('birth', 'death')`,
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

      baseItems = rows.map((r) => ({
        ...r,
        birthDate: eventsByPerson.get(r.id)?.birthDate ?? null,
        deathDate: eventsByPerson.get(r.id)?.deathDate ?? null,
      }));
    }

    const extras = await queryPersonExtras(
      familyDb,
      baseItems.map((it) => it.id),
    );

    const items = baseItems.map((it) => {
      const ex = extras.get(it.id);
      return {
        ...it,
        sourcesCount: ex?.sourcesCount ?? 0,
        completeness: ex?.completeness ?? 0,
        validation: ex?.validation ?? 'confirmed',
        birthPlace: ex?.birthPlace ?? null,
        updatedAt: ex?.updatedAt ?? '',
      };
    });

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return handleAuthError(error);
  }
}
