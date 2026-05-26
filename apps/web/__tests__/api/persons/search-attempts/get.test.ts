import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => {
    if (err instanceof Error && err.name === 'ForbiddenError') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message.includes('Not authenticated')) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  },
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/persons/[id]/search-attempts/route';
import { withAuth } from '@/lib/auth/api-guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERSON_ID = 'person-001';

/**
 * A row as Drizzle would return it from SQLite (timestamps as Date objects).
 */
function makeRow(overrides: {
  id: string;
  outcome?: string;
  providerKind?: string;
  threadId?: string | null;
  searchedAt?: Date;
}): Record<string, unknown> {
  const now = new Date('2026-05-26T10:00:00Z');
  return {
    id: overrides.id,
    personId: PERSON_ID,
    threadId: overrides.threadId ?? null,
    researchItemId: null,
    providerKind: overrides.providerKind ?? 'familysearch',
    providerLabel: null,
    query: null,
    searchedAt: overrides.searchedAt ?? now,
    outcome: overrides.outcome ?? 'found',
    notes: null,
    createdBy: 'u1',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build a minimal Drizzle-like familyDb mock for GET.
 *
 * The route calls:
 *   familyDb.select().from(...).where(...).orderBy(...).limit(n).all()
 *
 * rows: the ordered array the mock returns from `.all()`.
 */
function makeFamilyDb(rows: Record<string, unknown>[] = []) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(rows),
  };

  return {
    select: vi.fn(() => selectChain),
    _selectChain: selectChain,
  } as unknown as ReturnType<typeof import('@ancstra/db')['createFamilyDb']>;
}

function authSuccess(familyDb: ReturnType<typeof makeFamilyDb> = makeFamilyDb()) {
  vi.mocked(withAuth).mockResolvedValue({
    familyDb,
    ctx: {
      userId: 'u1',
      familyId: 'fam1',
      role: 'editor' as const,
      actualRole: 'editor' as const,
      dbFilename: 'fam.db',
    },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });
  return familyDb;
}

function authSuccess_viewer(familyDb: ReturnType<typeof makeFamilyDb> = makeFamilyDb()) {
  vi.mocked(withAuth).mockResolvedValue({
    familyDb,
    ctx: {
      userId: 'u2',
      familyId: 'fam1',
      role: 'viewer' as const,
      actualRole: 'viewer' as const,
      dbFilename: 'fam.db',
    },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });
  return familyDb;
}

function authForbidden() {
  const err = Object.assign(new Error('tree:view'), { name: 'ForbiddenError' });
  vi.mocked(withAuth).mockRejectedValue(err);
}

function makeRequest(personId: string, queryString = '') {
  return new Request(
    `http://localhost/api/persons/${personId}/search-attempts${queryString ? `?${queryString}` : ''}`,
    { method: 'GET' },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/persons/[id]/search-attempts (Bundle E)', () => {

  // -------------------------------------------------------------------------
  // 1. Empty list
  // -------------------------------------------------------------------------

  it('200 empty list when no attempts exist', async () => {
    authSuccess(makeFamilyDb([]));
    const req = makeRequest(PERSON_ID);
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. Sorted DESC
  // -------------------------------------------------------------------------

  it('200 returns items in the order provided by the DB query', async () => {
    const rows = [
      makeRow({ id: 'sa-2', searchedAt: new Date('2026-05-26T10:00:00Z') }),
      makeRow({ id: 'sa-1', searchedAt: new Date('2026-05-25T10:00:00Z') }),
      makeRow({ id: 'sa-3', searchedAt: new Date('2026-05-24T10:00:00Z') }),
    ];
    authSuccess(makeFamilyDb(rows));
    const req = makeRequest(PERSON_ID);
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((r: { id: string }) => r.id)).toEqual(['sa-2', 'sa-1', 'sa-3']);
  });

  // -------------------------------------------------------------------------
  // 3. Filter by outcome — withAuth called, query passed through
  // -------------------------------------------------------------------------

  it('200 passes outcome filter — passes query string through to DB', async () => {
    const db = authSuccess(makeFamilyDb([makeRow({ id: 'sa-n1', outcome: 'negative' })]));
    const req = makeRequest(PERSON_ID, 'outcome=negative');
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.map((r: { id: string }) => r.id)).toEqual(['sa-n1']);
    // The where() clause was called (filter was applied)
    expect(
      (db as unknown as { _selectChain: { where: ReturnType<typeof vi.fn> } })._selectChain.where,
    ).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. Filter by providerKind
  // -------------------------------------------------------------------------

  it('200 passes providerKind filter through', async () => {
    authSuccess(makeFamilyDb([makeRow({ id: 'sa-an', providerKind: 'ancestry' })]));
    const req = makeRequest(PERSON_ID, 'providerKind=ancestry');
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('sa-an');
  });

  // -------------------------------------------------------------------------
  // 5. Filter by threadId
  // -------------------------------------------------------------------------

  it('200 passes threadId filter through', async () => {
    // Use a UUID with valid version (4) and variant (8) bytes so Zod 4 accepts it.
    const tid = '11111111-1111-4111-8111-111111111111';
    authSuccess(makeFamilyDb([makeRow({ id: 'sa-tied', threadId: tid })]));
    const req = makeRequest(PERSON_ID, `threadId=${tid}`);
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('sa-tied');
  });

  // -------------------------------------------------------------------------
  // 6. Cursor pagination — limit+1 trick
  // -------------------------------------------------------------------------

  it('200 sets nextCursor when DB returns limit+1 rows', async () => {
    // limit=2, return 3 rows → hasMore=true → nextCursor set, items is 2
    const t1 = new Date('2026-05-26T10:00:00Z');
    const t2 = new Date('2026-05-25T10:00:00Z');
    const t3 = new Date('2026-05-24T10:00:00Z');
    const rows = [
      makeRow({ id: 'sa-2', searchedAt: t1 }),
      makeRow({ id: 'sa-1', searchedAt: t2 }),
      makeRow({ id: 'sa-3', searchedAt: t3 }), // extra row (limit+1)
    ];
    authSuccess(makeFamilyDb(rows));
    const req = makeRequest(PERSON_ID, 'limit=2');
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items.map((r: { id: string }) => r.id)).toEqual(['sa-2', 'sa-1']);
    expect(body.nextCursor).toBeTruthy();

    // Verify the cursor decodes to the last item of the page (sa-1).
    const decoded = JSON.parse(Buffer.from(body.nextCursor, 'base64url').toString('utf8'));
    expect(decoded.id).toBe('sa-1');
    expect(decoded.searchedAt).toBe(t2.getTime());
  });

  // -------------------------------------------------------------------------
  // 7. nextCursor null when items < limit
  // -------------------------------------------------------------------------

  it('200 nextCursor=null when items.length < limit', async () => {
    authSuccess(makeFamilyDb([makeRow({ id: 'sa-1' })]));
    const req = makeRequest(PERSON_ID, 'limit=50');
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 8. 400 on bad cursor
  // -------------------------------------------------------------------------

  it('400 INVALID_INPUT on malformed cursor', async () => {
    authSuccess();
    const req = makeRequest(PERSON_ID, 'cursor=not-valid-base64-json');
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  // -------------------------------------------------------------------------
  // 9. 400 on invalid outcome filter value
  // -------------------------------------------------------------------------

  it('400 INVALID_INPUT on unknown outcome filter value', async () => {
    authSuccess();
    const req = makeRequest(PERSON_ID, 'outcome=banana');
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  // -------------------------------------------------------------------------
  // 10. 403 when caller has no family access
  // -------------------------------------------------------------------------

  it('403 when caller has no family access', async () => {
    authForbidden();
    const req = makeRequest(PERSON_ID);
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 11. viewer role can GET (read-only — tree:view permission)
  // -------------------------------------------------------------------------

  it('200 viewer role can GET search attempts', async () => {
    authSuccess_viewer(makeFamilyDb([]));
    const req = makeRequest(PERSON_ID);
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    expect(res.status).toBe(200);
    // withAuth was called with the viewer-friendly permission key
    expect(vi.mocked(withAuth)).toHaveBeenCalledWith('tree:view', expect.anything());
  });

  // -------------------------------------------------------------------------
  // 12. Response shape validation — searchedAt serialized as epoch ms number
  // -------------------------------------------------------------------------

  it('200 serializes timestamps as epoch ms numbers', async () => {
    const ts = new Date('2026-05-26T12:00:00Z');
    authSuccess(makeFamilyDb([makeRow({ id: 'sa-ts', searchedAt: ts })]));
    const req = makeRequest(PERSON_ID);
    const res = await GET(req, { params: Promise.resolve({ id: PERSON_ID }) });
    const body = await res.json();
    expect(typeof body.items[0].searchedAt).toBe('number');
    expect(body.items[0].searchedAt).toBe(ts.getTime());
  });
});
