import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { searchAttempts, persons } from '@ancstra/db';
import { withAuth, handleAuthError } from '@/lib/auth/api-guard';
import {
  CreateSearchAttemptSchema,
  ListSearchAttemptsQuerySchema,
} from '@/lib/validators/search-attempts';

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

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

interface CursorPayload {
  searchedAt: number;
  id: string;
}

function encodeCursor(p: CursorPayload): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
}

function decodeCursor(s: string): CursorPayload | null {
  try {
    // Accept both base64url and plain base64 for robustness.
    const json = Buffer.from(s, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      typeof parsed.searchedAt === 'number'
      && typeof parsed.id === 'string'
      && parsed.id.length > 0
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Bundle E 2026-05-26 — list a person's search attempts.
 *
 * Auth: tree:view (viewer+) — read-only endpoint.
 * Sort: searched_at DESC, id DESC (stable secondary sort).
 * Filters: outcome, providerKind, threadId.
 * Cursor: base64url({searchedAt, id}) — opaque to the client.
 * Pagination: limit default 50, cap 100 (limit+1 trick to detect next page).
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §3.2.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: personId } = await params;
  try {
    // tree:view is the lowest-privilege permission — viewer, editor, admin,
    // owner all have it. This makes the list endpoint accessible to all family
    // members, consistent with persons/[id]/route.ts GET.
    const { familyDb } = await withAuth('tree:view', request);

    const url = new URL(request.url);
    const queryObj = Object.fromEntries(url.searchParams.entries());
    const parsed = ListSearchAttemptsQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return NextResponse.json({
        error: { code: 'INVALID_INPUT', message: 'Invalid query parameters.' },
      }, { status: 400 });
    }
    const q = parsed.data;

    // Decode cursor if provided.
    let cursorPayload: CursorPayload | null = null;
    if (q.cursor) {
      cursorPayload = decodeCursor(q.cursor);
      if (!cursorPayload) {
        return NextResponse.json({
          error: { code: 'INVALID_INPUT', message: 'Invalid cursor.' },
        }, { status: 400 });
      }
    }

    // Build WHERE clauses.
    const conditions = [eq(searchAttempts.personId, personId)];
    if (q.outcome) conditions.push(eq(searchAttempts.outcome, q.outcome));
    if (q.providerKind) conditions.push(eq(searchAttempts.providerKind, q.providerKind));
    if (q.threadId) conditions.push(eq(searchAttempts.threadId, q.threadId));
    if (cursorPayload) {
      // Keyset pagination: (searched_at, id) < (cursor.searched_at, cursor.id)
      // in DESC sort order (i.e., older than the last item on the previous page).
      const c = cursorPayload;
      conditions.push(
        or(
          lt(searchAttempts.searchedAt, new Date(c.searchedAt)),
          and(
            eq(searchAttempts.searchedAt, new Date(c.searchedAt)),
            lt(searchAttempts.id, c.id),
          ),
        )!,
      );
    }

    // Fetch limit+1 so we can detect whether another page exists.
    const rows = await familyDb
      .select()
      .from(searchAttempts)
      .where(and(...conditions))
      .orderBy(desc(searchAttempts.searchedAt), desc(searchAttempts.id))
      .limit(q.limit + 1)
      .all();

    const hasMore = rows.length > q.limit;
    const items = hasMore ? rows.slice(0, q.limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({
        searchedAt: last.searchedAt.getTime(),
        id: last.id,
      });
    }

    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        personId: r.personId,
        threadId: r.threadId,
        researchItemId: r.researchItemId,
        providerKind: r.providerKind,
        providerLabel: r.providerLabel,
        query: r.query,
        searchedAt: r.searchedAt.getTime(),
        outcome: r.outcome,
        notes: r.notes,
        createdBy: r.createdBy,
        createdAt: r.createdAt.getTime(),
        updatedAt: r.updatedAt.getTime(),
      })),
      nextCursor,
    });
  } catch (err) {
    try { return handleAuthError(err); } catch { /* not auth */ }
    console.error('[persons/[id]/search-attempts GET]', err);
    return NextResponse.json({
      error: { code: 'INTERNAL', message: String(err) },
    }, { status: 500 });
  }
}
