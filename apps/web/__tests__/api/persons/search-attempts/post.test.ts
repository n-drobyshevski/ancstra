import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => {
    // Implement the same contract as the real handleAuthError so 403/401
    // paths return proper JSON responses (not thrown errors).
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

import { POST } from '@/app/api/persons/[id]/search-attempts/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERSON_ID = 'person-001';
const MISSING_PERSON_ID = 'no-such-person';

/**
 * Build a minimal Drizzle-like familyDb mock.
 *
 * The route calls:
 *   - familyDb.select({ id: persons.id }).from(persons).where(...).all()  → person lookup
 *   - familyDb.insert(searchAttempts).values({ ... }).run()               → insert new row
 *
 * personExists controls what the select chain returns.
 */
function makeFamilyDb(personExists = true) {
  const allResult = personExists ? [{ id: PERSON_ID }] : [];

  // Fluent chain mock for Drizzle select:
  //   familyDb.select({...}).from(table).where(cond).all()
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(allResult),
  };

  // Fluent chain mock for Drizzle insert:
  //   familyDb.insert(table).values({...}).run()
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
  };

  return {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    _selectChain: selectChain,
    _insertChain: insertChain,
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

function authForbidden() {
  const err = Object.assign(new Error('ai:research'), { name: 'ForbiddenError' });
  vi.mocked(withAuth).mockRejectedValue(err);
}

function makeRequest(personId: string, body: unknown) {
  return new Request(
    `http://localhost/api/persons/${personId}/search-attempts`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/persons/[id]/search-attempts (Bundle E)', () => {
  // -------------------------------------------------------------------------
  // 1. Happy path — found, minimal payload
  // -------------------------------------------------------------------------

  it('201 on happy `found` create with minimal payload', async () => {
    authSuccess();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^[0-9a-f]{8}-/);
    expect(body.outcome).toBe('found');
    expect(body.providerKind).toBe('familysearch');
  });

  // -------------------------------------------------------------------------
  // 2. Happy path — negative with notes
  // -------------------------------------------------------------------------

  it('201 on happy `negative` create with non-empty notes', async () => {
    authSuccess();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'ancestry',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'negative',
        notes: 'Tried 3 spelling variants, 5-year window. No record.',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.outcome).toBe('negative');
    expect(body.notes).toMatch(/spelling variants/);
  });

  // -------------------------------------------------------------------------
  // 3. 400 INVALID_INPUT — negative without notes
  // -------------------------------------------------------------------------

  it('400 INVALID_INPUT on `negative` without notes', async () => {
    authSuccess();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'ancestry',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'negative',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
    expect(body.error.fields?.notes).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 4. 400 INVALID_INPUT — inconclusive without notes
  // -------------------------------------------------------------------------

  it('400 INVALID_INPUT on `inconclusive` without notes', async () => {
    authSuccess();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'archive',
        providerLabel: 'Russian State Archive',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'inconclusive',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  // -------------------------------------------------------------------------
  // 5. 400 INVALID_INPUT — unknown providerKind
  // -------------------------------------------------------------------------

  it('400 INVALID_INPUT on unknown providerKind', async () => {
    authSuccess();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'banana',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  // -------------------------------------------------------------------------
  // 6. 403 FORBIDDEN — viewer role
  // -------------------------------------------------------------------------

  it('403 FORBIDDEN when the caller has viewer role', async () => {
    authForbidden();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 7. 404 NOT_FOUND — non-existent person
  // -------------------------------------------------------------------------

  it('404 NOT_FOUND on non-existent person', async () => {
    authSuccess(makeFamilyDb(false)); // person lookup returns []
    const res = await POST(
      makeRequest(MISSING_PERSON_ID, {
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: MISSING_PERSON_ID }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // 8. Row persisted with correct personId and createdBy
  // -------------------------------------------------------------------------

  it('persists row with personId and createdBy = caller userId', async () => {
    const db = authSuccess();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();

    // Verify insert was called with the right personId and createdBy
    const insertCalls = vi.mocked(db.insert).mock.calls;
    expect(insertCalls.length).toBe(1);
    const valuesCalls = (db as unknown as { _insertChain: { values: ReturnType<typeof vi.fn> } })._insertChain.values.mock.calls;
    expect(valuesCalls.length).toBe(1);
    const inserted = valuesCalls[0][0];
    expect(inserted.personId).toBe(PERSON_ID);
    expect(inserted.createdBy).toBe('u1');
  });

  // -------------------------------------------------------------------------
  // 9. revalidateTag called with correct tag + 'max' second arg
  // -------------------------------------------------------------------------

  it("calls revalidateTag('search-attempts:person:...', 'max') on success", async () => {
    authSuccess();
    const res = await POST(
      makeRequest(PERSON_ID, {
        providerKind: 'familysearch',
        searchedAt: '2026-05-26T10:00:00Z',
        outcome: 'found',
      }),
      { params: Promise.resolve({ id: PERSON_ID }) },
    );
    expect(res.status).toBe(201);

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tag = `search-attempts:person:${PERSON_ID}`;
    const call = calls.find(([t]) => t === tag);
    expect(call).toBeDefined();
    expect(call![1]).toBe('max');
  });
});
