import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { events } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';
import { createEventSchema } from '@/lib/validation';
import { parseDateToSort } from '@ancstra/shared';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function POST(request: Request) {
  try {
    const { familyDb } = await withAuth('event:create');

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
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

    await familyDb.insert(events)
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

    const [created] = await familyDb
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .all();

    revalidateTag('persons', 'max');
    revalidateTag('dashboard-stats', 'max');
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('tree:view');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50')));
    const offset = (page - 1) * pageSize;
    const personId = searchParams.get('personId');
    const eventType = searchParams.get('eventType');

    const conditions = [];
    if (personId) {
      conditions.push(sql`${events.personId} = ${personId}`);
    }
    if (eventType) {
      conditions.push(sql`${events.eventType} = ${eventType}`);
    }

    const whereClause = conditions.length > 0
      ? sql.join(conditions, sql` AND `)
      : undefined;

    const rows = await familyDb
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(events.dateSort)
      .limit(pageSize)
      .offset(offset)
      .all();

    const [{ count: total }] = await familyDb
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(whereClause)
      .all();

    return NextResponse.json({ items: rows, total, page, pageSize });
  } catch (error) {
    return handleAuthError(error);
  }
}
