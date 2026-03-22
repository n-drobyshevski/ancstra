import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, events } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { updateEventSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';

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
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const db = createDb();

  // Check event exists
  const [existing] = db
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

  db.update(events).set(updates).where(eq(events.id, id)).run();

  const [updated] = db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .all();

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

  // Check event exists
  const [existing] = db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .all();
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  db.delete(events).where(eq(events.id, id)).run();

  return NextResponse.json({ success: true });
}
