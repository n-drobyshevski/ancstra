import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { eq } from 'drizzle-orm';
import { searchAttempts, persons } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import { CreateSearchAttemptSchema } from '@/lib/validators/search-attempts';

/**
 * Bundle E 2026-05-26 — POST a new search attempt for a person.
 *
 * Auth: editor+ on the family that owns the person.
 * Body: CreateSearchAttemptSchema (with superRefine notes-required).
 * Side effects: INSERT row + revalidateTag('search-attempts:person:[id]', 'max').
 * No audit event (E-Q9).
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §3.1.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: personId } = await params;
  try {
    const { familyDb, ctx } = await withAuth('ai:research', request);

    // Resolve person to confirm it exists under this family.
    const personRows = await familyDb
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.id, personId))
      .all();
    if (personRows.length === 0) {
      return NextResponse.json({
        error: { code: 'NOT_FOUND', message: 'Person not found.' },
      }, { status: 404 });
    }

    const json = await request.json().catch(() => null);
    const parsed = CreateSearchAttemptSchema.safeParse(json);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? '_');
        fields[k] = issue.message;
      }
      return NextResponse.json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Request body failed validation.',
          fields,
        },
      }, { status: 400 });
    }

    const data = parsed.data;
    const id = crypto.randomUUID();
    const now = new Date();
    await familyDb.insert(searchAttempts).values({
      id,
      personId,
      threadId: data.threadId ?? null,
      researchItemId: data.researchItemId ?? null,
      providerKind: data.providerKind,
      providerLabel: data.providerLabel ?? null,
      query: data.query ?? null,
      searchedAt: data.searchedAt,
      outcome: data.outcome,
      notes: data.notes ?? null,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    }).run();

    revalidateTag(`search-attempts:person:${personId}`, 'max');

    return NextResponse.json({
      id,
      personId,
      threadId: data.threadId ?? null,
      researchItemId: data.researchItemId ?? null,
      providerKind: data.providerKind,
      providerLabel: data.providerLabel ?? null,
      query: data.query ?? null,
      searchedAt: data.searchedAt.getTime(),
      outcome: data.outcome,
      notes: data.notes ?? null,
      createdBy: ctx.userId,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    }, { status: 201 });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[persons/[id]/search-attempts POST]', err);
    return NextResponse.json({
      error: { code: 'INTERNAL', message: String(err) },
    }, { status: 500 });
  }
}

// GET is wired in Task 5 — placeholder stub here so the route file exists.
export async function GET(
  _request: Request,
  _params: { params: Promise<{ id: string }> },
) {
  return NextResponse.json({
    error: { code: 'NOT_IMPLEMENTED', message: 'GET wired in Task 5.' },
  }, { status: 501 });
}
