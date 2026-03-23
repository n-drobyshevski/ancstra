import { NextResponse } from 'next/server';
import { sources, sourceCitations } from '@ancstra/db';
import { sql } from 'drizzle-orm';
import { createSourceSchema } from '@/lib/validation';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';

export async function POST(request: Request) {
  try {
    const { ctx, familyDb } = await withAuth('source:create');

    const body = await request.json();
    const parsed = createSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await familyDb.insert(sources)
      .values({
        id,
        title: data.title,
        author: data.author ?? null,
        publisher: data.publisher ?? null,
        publicationDate: data.publicationDate ?? null,
        repositoryName: data.repositoryName ?? null,
        repositoryUrl: data.repositoryUrl ?? null,
        sourceType: data.sourceType ?? null,
        notes: data.notes ?? null,
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const [source] = await familyDb
      .select()
      .from(sources)
      .where(sql`${sources.id} = ${id}`)
      .all();

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { familyDb } = await withAuth('tree:view');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20')));
    const offset = (page - 1) * pageSize;
    const q = searchParams.get('q');

    const whereClause = q
      ? sql`${sources.title} LIKE ${'%' + q + '%'}`
      : undefined;

    const rows = await familyDb
      .select()
      .from(sources)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .all();

    const countQuery = q
      ? await familyDb
          .select({ count: sql<number>`count(*)` })
          .from(sources)
          .where(sql`${sources.title} LIKE ${'%' + q + '%'}`)
          .all()
      : await familyDb
          .select({ count: sql<number>`count(*)` })
          .from(sources)
          .all();

    const [{ count: total }] = countQuery;

    // Count citations per source
    const sourceIds = rows.map((r) => r.id);
    const citationCounts =
      sourceIds.length > 0
        ? await familyDb
            .select({
              sourceId: sourceCitations.sourceId,
              count: sql<number>`count(*)`,
            })
            .from(sourceCitations)
            .where(
              sql`${sourceCitations.sourceId} IN (${sql.join(
                sourceIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            )
            .groupBy(sourceCitations.sourceId)
            .all()
        : [];

    const countMap = new Map(citationCounts.map((c) => [c.sourceId, c.count]));

    const items = rows.map((r) => ({
      ...r,
      citationCount: countMap.get(r.id) ?? 0,
    }));

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    return handleAuthError(error);
  }
}
