import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, personNames, events, refreshSummary } from '@ancstra/db';
import { createPersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { withAuth, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';
import { personsCache } from '@/lib/persons/search-params';
import { queryPersonsList } from '@/lib/persons/query-persons-list';

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
    const rawParams: Record<string, string | string[]> = {};
    searchParams.forEach((value, key) => {
      const existing = rawParams[key];
      if (existing === undefined) {
        rawParams[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        rawParams[key] = [existing, value];
      }
    });
    const filters = await personsCache.parse(rawParams);

    const result = await queryPersonsList(familyDb, filters);

    return NextResponse.json({
      items: result.items,
      total: result.total,
      page: filters.page,
      size: filters.size,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
