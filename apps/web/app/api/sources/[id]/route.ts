import { NextResponse } from 'next/server';
import { sources, sourceCitations } from '@ancstra/db';
import { eq, sql } from 'drizzle-orm';
import { updateSourceSchema } from '@/lib/validation';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('tree:view');
    const { id } = await params;

    const [source] = await familyDb
      .select()
      .from(sources)
      .where(eq(sources.id, id))
      .all();

    if (!source) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [{ count: citationCount }] = await familyDb
      .select({ count: sql<number>`count(*)` })
      .from(sourceCitations)
      .where(eq(sourceCitations.sourceId, id))
      .all();

    return NextResponse.json({ ...source, citationCount });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyDb } = await withAuth('source:edit');

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
    const now = new Date().toISOString();

    const [existing] = await familyDb
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

    await familyDb.update(sources)
      .set(updates)
      .where(eq(sources.id, id))
      .run();

    const [updated] = await familyDb
      .select()
      .from(sources)
      .where(eq(sources.id, id))
      .all();

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
    const { familyDb } = await withAuth('source:edit');

    const { id } = await params;

    const [existing] = await familyDb
      .select()
      .from(sources)
      .where(eq(sources.id, id))
      .all();

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await familyDb.delete(sources)
      .where(eq(sources.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
