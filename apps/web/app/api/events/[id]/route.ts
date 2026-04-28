import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { events, refreshSummary } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { updateEventSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('event:edit');

    const { id } = await params;
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check event exists
    const [existing] = await familyDb
      .select()
      .from(events)
      .where(eq(events.id, id))
      .all();
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = { updatedAt: now };

    if (data.eventType !== undefined) updates.eventType = data.eventType;
    if (data.placeText !== undefined) updates.placeText = data.placeText;
    if (data.description !== undefined) updates.description = data.description;
    if (data.dateModifier !== undefined) updates.dateModifier = data.dateModifier;

    if (data.dateOriginal !== undefined) {
      updates.dateOriginal = data.dateOriginal;
      updates.dateSort = data.dateOriginal
        ? parseDateToSort(data.dateOriginal)
        : null;
    }

    if (data.dateEndOriginal !== undefined) {
      updates.dateEndSort = data.dateEndOriginal
        ? parseDateToSort(data.dateEndOriginal)
        : null;
    }

    await familyDb.update(events).set(updates).where(eq(events.id, id)).run();

    const [updated] = await familyDb
      .select()
      .from(events)
      .where(eq(events.id, id))
      .all();

    if (existing.personId) {
      await refreshSummary(familyDb, existing.personId);
    }
    revalidateTag('persons', 'max');
    revalidateTag('persons-list', 'max');
    revalidateTag('tree-data', 'max');
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
    const { familyDb } = await withAuth('event:edit');

    const { id } = await params;

    // Check event exists
    const [existing] = await familyDb
      .select()
      .from(events)
      .where(eq(events.id, id))
      .all();
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await familyDb.delete(events).where(eq(events.id, id)).run();

    if (existing.personId) {
      await refreshSummary(familyDb, existing.personId);
    }
    revalidateTag('persons', 'max');
    revalidateTag('persons-list', 'max');
    revalidateTag('tree-data', 'max');
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
