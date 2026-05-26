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

import { PATCH } from '@/app/api/search-attempts/[id]/route';
import { withAuth } from '@/lib/auth/api-guard';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERSON_ID = 'person-001';
const ATTEMPT_ID = '00000000-0000-0000-0000-000000000aaa';

/**
 * A row as Drizzle would return it from SQLite (timestamps as Date objects).
 */
function makeExistingRow(overrides: Partial<{
  outcome: string;
  notes: string | null;
  query: string | null;
  searchedAt: Date;
  updatedAt: Date;
  createdAt: Date;
  providerKind: string;
  threadId: string | null;
}> = {}): Record<string, unknown> {
  const now = new Date('2026-05-25T10:00:00Z');
  return {
    id: ATTEMPT_ID,
    personId: PERSON_ID,
    threadId: overrides.threadId ?? null,
    researchItemId: null,
    providerKind: overrides.providerKind ?? 'familysearch',
    providerLabel: null,
    query: overrides.query ?? 'Anna Petrova 1923',
    searchedAt: overrides.searchedAt ?? now,
    outcome: overrides.outcome ?? 'found',
    notes: overrides.notes ?? null,
    createdBy: 'u1',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

/**
 * Build a minimal Drizzle-like familyDb mock for PATCH.
 *
 * The route calls:
 *   - familyDb.select().from(searchAttempts).where(eq(id, attemptId)).all() → existing row
 *   - familyDb.update(searchAttempts).set({...}).where(...).run()           → patch
 *
 * existing: the row returned from the initial select (empty array → 404).
 */
function makeFamilyDb(existing: Record<string, unknown>[] = []) {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(existing),
  };

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
  };

  return {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => updateChain),
    _selectChain: selectChain,
    _updateChain: updateChain,
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

function makeRequest(attemptId: string, body: unknown) {
  return new Request(
    `http://localhost/api/search-attempts/${attemptId}`,
    {
      method: 'PATCH',
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

describe('PATCH /api/search-attempts/[id] (Bundle E)', () => {
  // -------------------------------------------------------------------------
  // 1. Happy partial edit — query only
  // -------------------------------------------------------------------------

  it('200 on happy partial edit (query change only)', async () => {
    authSuccess(makeFamilyDb([makeExistingRow()]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { query: 'Anna Petrova 1924-1926' }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe('Anna Petrova 1924-1926');
    expect(body.outcome).toBe('found'); // preserved from existing
  });

  // -------------------------------------------------------------------------
  // 2. THE critical test — 400 when patching outcome=negative on a row whose
  //    notes are empty. Proves merged-row check fires.
  // -------------------------------------------------------------------------

  it('400 NOTES_REQUIRED when patching outcome=negative on a row whose notes are empty', async () => {
    authSuccess(makeFamilyDb([makeExistingRow({ outcome: 'found', notes: null })]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { outcome: 'negative' }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('NOTES_REQUIRED');
    expect(body.error.fields?.notes).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 3. 200 changing outcome → negative with notes supplied in same patch
  // -------------------------------------------------------------------------

  it('200 changing outcome from found → negative when notes are supplied in same patch', async () => {
    authSuccess(makeFamilyDb([makeExistingRow({ outcome: 'found', notes: null })]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, {
        outcome: 'negative',
        notes: 'On further review, no record found.',
      }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('negative');
    expect(body.notes).toMatch(/no record/);
  });

  // -------------------------------------------------------------------------
  // 4. 200 partial patch on already-negative attempt — only updating query
  //    preserves notes (merged outcome=negative, merged notes preserved).
  // -------------------------------------------------------------------------

  it('200 partial patch on already-negative attempt preserves notes', async () => {
    authSuccess(makeFamilyDb([
      makeExistingRow({ outcome: 'negative', notes: 'tried 3 variants' }),
    ]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { query: 'updated query' }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('negative');
    expect(body.notes).toBe('tried 3 variants');
    expect(body.query).toBe('updated query');
  });

  // -------------------------------------------------------------------------
  // 5. 400 NOTES_REQUIRED when patching notes→null on existing negative row
  // -------------------------------------------------------------------------

  it('400 NOTES_REQUIRED when patching notes→null on an existing negative row', async () => {
    authSuccess(makeFamilyDb([
      makeExistingRow({ outcome: 'negative', notes: 'tried 3 variants' }),
    ]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { notes: null }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('NOTES_REQUIRED');
  });

  // -------------------------------------------------------------------------
  // 6. 400 INVALID_INPUT on unknown providerKind
  // -------------------------------------------------------------------------

  it('400 INVALID_INPUT on unknown providerKind', async () => {
    authSuccess(makeFamilyDb([makeExistingRow()]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { providerKind: 'banana' }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  // -------------------------------------------------------------------------
  // 7. updatedAt bumps on every successful PATCH
  // -------------------------------------------------------------------------

  it('bumps updatedAt on every successful PATCH', async () => {
    const seededUpdatedAt = new Date('2026-05-25T10:00:00Z');
    const db = authSuccess(makeFamilyDb([
      makeExistingRow({ updatedAt: seededUpdatedAt }),
    ]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { query: 'updated query' }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.updatedAt).toBe('number');
    expect(body.updatedAt).toBeGreaterThan(seededUpdatedAt.getTime());

    // Verify the UPDATE set() call included a fresh updatedAt
    const setCalls = (db as unknown as { _updateChain: { set: ReturnType<typeof vi.fn> } })
      ._updateChain.set.mock.calls;
    expect(setCalls.length).toBe(1);
    const setArg = setCalls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(setArg.updatedAt.getTime()).toBeGreaterThan(seededUpdatedAt.getTime());
  });

  // -------------------------------------------------------------------------
  // 8. 404 NOT_FOUND on missing attempt
  // -------------------------------------------------------------------------

  it('404 NOT_FOUND on missing attempt', async () => {
    authSuccess(makeFamilyDb([])); // empty existing
    const res = await PATCH(
      makeRequest('no-such-id', { query: 'whatever' }),
      { params: Promise.resolve({ id: 'no-such-id' }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // 9. 403 FORBIDDEN when caller has viewer role
  // -------------------------------------------------------------------------

  it('403 FORBIDDEN when caller has viewer role', async () => {
    authForbidden();
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { query: 'viewer-attempted edit' }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(403);
  });

  // -------------------------------------------------------------------------
  // 10. revalidateTag called with correct tag (from existing.personId) + 'max'
  // -------------------------------------------------------------------------

  it("calls revalidateTag('search-attempts:person:<existing.personId>', 'max') on success", async () => {
    authSuccess(makeFamilyDb([makeExistingRow()]));
    const res = await PATCH(
      makeRequest(ATTEMPT_ID, { query: 'new query' }),
      { params: Promise.resolve({ id: ATTEMPT_ID }) },
    );
    expect(res.status).toBe(200);

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tag = `search-attempts:person:${PERSON_ID}`;
    const call = calls.find(([t]) => t === tag);
    expect(call).toBeDefined();
    expect(call![1]).toBe('max');
  });
});
