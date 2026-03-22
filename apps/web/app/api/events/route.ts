import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, events } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { createEventSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();
  const now = new Date().toISOString();

  const dateSort = data.dateOriginal
    ? parseDateToSort(data.dateOriginal)
    : null;
  const dateEndSort = data.dateEndOriginal
    ? parseDateToSort(data.dateEndOriginal)
    : null;

  // Auto-set between modifier when both dates present and no explicit modifier
  const dateModifier =
    data.dateModifier ??
    (data.dateOriginal && data.dateEndOriginal ? 'between' : 'exact');

  const eventId = crypto.randomUUID();

  db.insert(events)
    .values({
      id: eventId,
      eventType: data.eventType,
      dateOriginal: data.dateOriginal ?? null,
      dateSort,
      dateModifier,
      dateEndSort,
      placeText: data.placeText ?? null,
      description: data.description ?? null,
      personId: data.personId ?? null,
      familyId: data.familyId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const [created] = db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .all();

  return NextResponse.json(created, { status: 201 });
}
