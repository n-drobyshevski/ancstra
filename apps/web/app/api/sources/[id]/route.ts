import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDb, sources, sourceCitations } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';
import { updateSourceSchema } from '@/lib/validation';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = createDb();

  const [source] = db
    .select()
    .from(sources)
    .where(eq(sources.id, id))
    .all();

  if (!source) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [{ count: citationCount }] = db
    .select({ count: sql<number>`count(*)` })
    .from(sourceCitations)
    .where(eq(sourceCitations.sourceId, id))
    .all();

  return NextResponse.json({ ...source, citationCount });
}

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
  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = createDb();
  const now = new Date().toISOString();

  const [existing] = db
    .select()
    .from(sources)
    .where(eq(sources.id, id))
    .all();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.title !== undefined) updates.title = data.title;
  if (data.author !== undefined) updates.author = data.author;
  if (data.publisher !== undefined) updates.publisher = data.publisher;
  if (data.publicationDate !== undefined) updates.publicationDate = data.publicationDate;
  if (data.repositoryName !== undefined) updates.repositoryName = data.repositoryName;
  if (data.repositoryUrl !== undefined) updates.repositoryUrl = data.repositoryUrl;
  if (data.sourceType !== undefined) updates.sourceType = data.sourceType;
  if (data.notes !== undefined) updates.notes = data.notes;

  db.update(sources)
    .set(updates)
    .where(eq(sources.id, id))
    .run();

  const [updated] = db
    .select()
    .from(sources)
    .where(eq(sources.id, id))
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

  const [existing] = db
    .select()
    .from(sources)
    .where(eq(sources.id, id))
    .all();

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  db.delete(sources)
    .where(eq(sources.id, id))
    .run();

  return NextResponse.json({ success: true });
}
