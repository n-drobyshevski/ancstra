import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => {
    if (err instanceof Error && err.name === 'ForbiddenError') {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof Error && err.message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  },
}));

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { DELETE } from '@/app/api/search-attempts/[id]/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERSON_ID = 'person-001';
const ATTEMPT_ID = '00000000-0000-0000-0000-000000000bbb';

const EXISTING_ROW = {
  id: ATTEMPT_ID,
  personId: PERSON_ID,
  threadId: null,
  researchItemId: null,
  providerKind: 'familysearch',
  providerLabel: null,
  query: 'to be deleted',
  searchedAt: new Date('2026-05-25T10:00:00Z'),
  outcome: 'found',
  notes: null,
  createdBy: 'u1',
  createdAt: new Date('2026-05-25T10:00:00Z'),
  updatedAt: new Date('2026-05-25T10:00:00Z'),
};

/**
 * Build a minimal Drizzle-like familyDb mock for DELETE.
 *
 * The route calls:
 *   - familyDb.select({...}).from(searchAttempts).where(...).all() → existing row
 *   - familyDb.delete(searchAttempts).where(...).run()             → remove row
 *
 * existing: the row returned from the initial select (empty array → 404).
 */
function makeFamilyDb(existing: Record<string, unknown>[] = [EXISTING_ROW]) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(existing),
  };

  const deleteChain = {
    where: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
  };

  return {
    select: vi.fn(() => selectChain),
    delete: vi.fn(() => deleteChain),
    _selectChain: selectChain,
    _deleteChain: deleteChain,
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

function makeRequest(attemptId: string) {
  return new Request(
    `http://localhost/api/search-attempts/${attemptId}`,
    { method: 'DELETE' },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /api/search-attempts/[id] (Bundle E)', () => {
  // -------------------------------------------------------------------------
  // 1. 204 on happy delete
  // -------------------------------------------------------------------------

  it('204 on happy delete', async () => {
    authSuccess(makeFamilyDb([EXISTING_ROW]));
    const res = await DELETE(
      makeRequest(ATTEMPT_ID),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(204);
    // 204 No Content — no response body
    expect(res.body).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. 404 on already-deleted (idempotency check — not 204)
  // -------------------------------------------------------------------------

  it('404 on already-deleted attempt (idempotency check)', async () => {
    authSuccess(makeFamilyDb([])); // empty existing → row gone
    const res = await DELETE(
      makeRequest(ATTEMPT_ID),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // 3. 403 FORBIDDEN when caller has viewer role
  // -------------------------------------------------------------------------

  it('403 FORBIDDEN when caller has viewer role', async () => {
    authForbidden();
    const res = await DELETE(
      makeRequest(ATTEMPT_ID),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 4. revalidateTag called with correct tag (from existing.personId) + 'max'
  // -------------------------------------------------------------------------

  it("calls revalidateTag('search-attempts:person:<existing.personId>', 'max') on success", async () => {
    authSuccess(makeFamilyDb([EXISTING_ROW]));
    const res = await DELETE(
      makeRequest(ATTEMPT_ID),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(204);

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tag = `search-attempts:person:${PERSON_ID}`;
    const call = calls.find(([t]) => t === tag);
    expect(call).toBeDefined();
    expect(call![1]).toBe('max');
  });
});
