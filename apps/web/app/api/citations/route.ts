import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, sources, sourceCitations } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import { createCitationSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();

  // Verify source exists
  const [source] = db
    .select()
    .from(sources)
    .where(eq(sources.id, data.sourceId))
    .all();
  if (!source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 });
  }

  const citationId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(sourceCitations)
    .values({
      id: citationId,
      sourceId: data.sourceId,
      citationDetail: data.citationDetail ?? null,
      citationText: data.citationText ?? null,
      confidence: data.confidence ?? 'medium',
      personId: data.personId ?? null,
      eventId: data.eventId ?? null,
      familyId: data.familyId ?? null,
      personNameId: data.personNameId ?? null,
      createdAt: now,
    })
    .run();

  // Return citation with source data joined
  const [created] = db
    .select()
    .from(sourceCitations)
    .where(eq(sourceCitations.id, citationId))
    .all();

  return NextResponse.json({ ...created, source }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const personId = searchParams.get('personId');
  const eventId = searchParams.get('eventId');
  const familyId = searchParams.get('familyId');

  if (!personId && !eventId && !familyId) {
    return NextResponse.json(
      { error: 'Entity filter required' },
      { status: 400 }
    );
  }

  const db = createDb();

  const filter = personId
    ? eq(sourceCitations.personId, personId)
    : eventId
      ? eq(sourceCitations.eventId, eventId)
      : eq(sourceCitations.familyId, familyId!);

  const citations = db
    .select()
    .from(sourceCitations)
    .where(filter)
    .all();

  // Join source data for each citation
  const result = citations.map((citation) => {
    const [source] = db
      .select()
      .from(sources)
      .where(eq(sources.id, citation.sourceId))
      .all();
    return { ...citation, source };
  });

  return NextResponse.json(result);
}
