import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { persons, personNames, events, refreshSummary } from '@ancstra/db';
import { eq, and, isNull } from 'drizzle-orm';
import { assemblePersonDetail } from '@/lib/queries';
import { updatePersonSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { withAuth, withOptimisticLock, handleAuthError, logAndInvalidate } from '@/lib/auth/api-guard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('tree:view');
    const { id } = await params;
    const person = await assemblePersonDetail(familyDb, id);
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(person);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('person:edit');

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
    const now = new Date().toISOString();

    // Check person exists
    const [existing] = await familyDb
      .select()
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .all();
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Optimistic lock if version provided
    if (data.version !== undefined) {
      const lock = await withOptimisticLock(familyDb, persons, id, data.version, {
        sex: data.sex ?? existing.sex,
        isLiving: data.isLiving ?? existing.isLiving,
        notes: data.notes ?? existing.notes,
      });
      if (!lock.success) {
        return NextResponse.json(
          { error: 'Conflict', current: lock.current },
          { status: 409 }
        );
      }
    }

    // Transaction: update person + name + upsert events
    await familyDb.transaction(async (tx) => {
      // 1. Update persons table (only provided fields)
      const personUpdates: Record<string, unknown> = { updatedAt: now };
      if (data.sex !== undefined) personUpdates.sex = data.sex;
      if (data.isLiving !== undefined) personUpdates.isLiving = data.isLiving;
      if (data.notes !== undefined) personUpdates.notes = data.notes;
      await tx.update(persons).set(personUpdates).where(eq(persons.id, id)).run();

      // 2. Update primary name if provided
      if (data.givenName || data.surname) {
        const nameUpdates: Record<string, unknown> = {};
        if (data.givenName) nameUpdates.givenName = data.givenName;
        if (data.surname) nameUpdates.surname = data.surname;
        await tx.update(personNames)
          .set(nameUpdates)
          .where(
            and(eq(personNames.personId, id), eq(personNames.isPrimary, true))
          )
          .run();
      }

      // 3. Upsert birth event
      if (data.birthDate !== undefined || data.birthPlace !== undefined) {
        const [existingBirth] = await tx
          .select()
          .from(events)
          .where(and(eq(events.personId, id), eq(events.eventType, 'birth')))
          .all();
        if (existingBirth) {
          await tx.update(events)
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
          await tx.insert(events)
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
        const [existingDeath] = await tx
          .select()
          .from(events)
          .where(and(eq(events.personId, id), eq(events.eventType, 'death')))
          .all();
        if (existingDeath) {
          await tx.update(events)
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
          await tx.insert(events)
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

    await refreshSummary(familyDb, id);
    const updated = await assemblePersonDetail(familyDb, id);
    revalidateTag(`person-${id}`);
    revalidateTag('persons');
    revalidateTag('persons-list');
    revalidateTag('tree-data');
    await logAndInvalidate(centralDb, ctx, {
      action: 'person_edited',
      entityType: 'person',
      entityId: id,
      summary: `Edited ${updated?.givenName ?? ''} ${updated?.surname ?? ''}`.trim() || 'Edited person',
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, familyDb, centralDb } = await withAuth('person:delete');

    const { id } = await params;

    const [existing] = await familyDb
      .select()
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .all();
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await familyDb.update(persons)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(persons.id, id))
      .run();

    await refreshSummary(familyDb, id);
    revalidateTag(`person-${id}`);
    revalidateTag('persons');
    revalidateTag('persons-list');
    revalidateTag('tree-data');
    revalidateTag('dashboard-stats');
    await logAndInvalidate(centralDb, ctx, {
      action: 'person_deleted',
      entityType: 'person',
      entityId: id,
      summary: 'Removed a person from the tree',
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
