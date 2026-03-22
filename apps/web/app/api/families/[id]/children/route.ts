import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, persons, families, children } from '@ancstra/db';
import { and, eq, isNull } from 'drizzle-orm';
import { addChildSchema } from '@/lib/validation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: familyId } = await params;
  const body = await request.json();
  const parsed = addChildSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();

  // Check family exists and not deleted
  const [family] = db
    .select({ id: families.id })
    .from(families)
    .where(and(eq(families.id, familyId), isNull(families.deletedAt)))
    .all();
  if (!family) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check person exists and not deleted
  const [person] = db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.id, data.personId), isNull(persons.deletedAt)))
    .all();
  if (!person) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check no duplicate link
  const [existing] = db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.familyId, familyId), eq(children.personId, data.personId)))
    .all();
  if (existing) {
    return NextResponse.json(
      { error: 'Child already linked to this family' },
      { status: 409 }
    );
  }

  db.insert(children)
    .values({
      id: crypto.randomUUID(),
      familyId,
      personId: data.personId,
      childOrder: data.childOrder ?? null,
      relationshipToParent1: data.relationshipToParent1 ?? 'biological',
      relationshipToParent2: data.relationshipToParent2 ?? 'biological',
      validationStatus: 'confirmed',
      createdAt: new Date().toISOString(),
    })
    .run();

  return NextResponse.json({ success: true }, { status: 201 });
}
