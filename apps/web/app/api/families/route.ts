import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, persons, families } from '@ancstra/db';
import { and, eq, or, isNull } from 'drizzle-orm';
import { createFamilySchema } from '@/lib/validation';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createFamilySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();

  // Check that provided person(s) exist and aren't soft-deleted
  if (data.partner1Id) {
    const [p1] = db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, data.partner1Id), isNull(persons.deletedAt)))
      .all();
    if (!p1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  if (data.partner2Id) {
    const [p2] = db
      .select({ id: persons.id })
      .from(persons)
      .where(and(eq(persons.id, data.partner2Id), isNull(persons.deletedAt)))
      .all();
    if (!p2) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  // Check no duplicate non-deleted family for this pair (both directions)
  if (data.partner1Id && data.partner2Id) {
    const [existing] = db
      .select({ id: families.id })
      .from(families)
      .where(
        and(
          isNull(families.deletedAt),
          or(
            and(
              eq(families.partner1Id, data.partner1Id),
              eq(families.partner2Id, data.partner2Id)
            ),
            and(
              eq(families.partner1Id, data.partner2Id),
              eq(families.partner2Id, data.partner1Id)
            )
          )
        )
      )
      .all();
    if (existing) {
      return NextResponse.json(
        { error: 'Family already exists for this pair' },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const familyId = crypto.randomUUID();

  db.insert(families)
    .values({
      id: familyId,
      partner1Id: data.partner1Id ?? null,
      partner2Id: data.partner2Id ?? null,
      relationshipType: data.relationshipType ?? 'unknown',
      validationStatus: 'confirmed',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const [created] = db
    .select()
    .from(families)
    .where(eq(families.id, familyId))
    .all();

  return NextResponse.json(created, { status: 201 });
}
