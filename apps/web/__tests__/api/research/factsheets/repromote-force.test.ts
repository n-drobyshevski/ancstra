import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/api-guard', () => ({
  withAuth: vi.fn(),
  handleAuthError: (err: unknown) => { throw err; },
}));

vi.mock('@/lib/research/active-thread-server', () => ({
  getActiveThreadIdFromCookies: vi.fn(async () => null),
}));

vi.mock('@ancstra/research', async () => {
  const actual = await vi.importActual<typeof import('@ancstra/research')>('@ancstra/research');
  return {
    ...actual,
    _unmergeFactsheetInTransaction: vi.fn(),
    _promoteSingleFactsheetInTransaction: vi.fn(),
    _forceRepromoteClusterMemberInTransaction: vi.fn(),
    computePatchDiff: vi.fn(),
    hashPatchDiff: vi.fn(),
    getClusterMembership: vi.fn(async () => ({ kind: 'no' as const })),
    logReverseEvent: vi.fn(async () => 'evt-force-1'),
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/research/factsheets/[id]/repromote-force/route';
import { withAuth } from '@/lib/auth/api-guard';
import {
  _unmergeFactsheetInTransaction,
  _promoteSingleFactsheetInTransaction,
  _forceRepromoteClusterMemberInTransaction,
  computePatchDiff,
  hashPatchDiff,
  getClusterMembership,
  logReverseEvent,
  ClusterMemberUseClusterUnmergeError,
  type PatchDiff,
} from '@ancstra/research';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FACTSHEET_ID = 'fs-1';
const OLD_PERSON_ID = 'old-p-1';
const NEW_PERSON_ID = 'new-p-2';
const CLUSTER_PROMOTION_ID = 'cp-1';
const CORRECT_HASH = 'a'.repeat(64);

const MOCK_DIFF: PatchDiff = {
  factsheetId: FACTSHEET_ID,
  personId: OLD_PERSON_ID,
  events: {
    added: [
      {
        eventType: 'birth',
        dateOriginal: '1900',
        dateSort: 19000000,
        placeText: 'NYC',
        description: null,
      },
    ],
    modified: [],
    unchanged: [],
  },
  citations: { added: [], unchanged: [] },
};

/**
 * Builds a minimal stand-in for the family Drizzle DB. The route calls
 * familyDb.run() for BEGIN IMMEDIATE / COMMIT / ROLLBACK and familyDb.all()
 * to fetch promoted_person_id during the cluster-member path.
 */
function makeFamilyDb(allResult: unknown[] = []) {
  return {
    all: vi.fn(async () => allResult),
    run: vi.fn(async () => ({ changes: 0, rowsAffected: 0 })),
  } as unknown as ReturnType<typeof import('@ancstra/db')['createFamilyDb']>;
}

function authSuccess(
  familyDb: ReturnType<typeof makeFamilyDb> = makeFamilyDb(),
) {
  vi.mocked(withAuth).mockResolvedValue({
    familyDb,
    ctx: { userId: 'u1', familyId: 'fam1', role: 'editor', actualRole: 'editor', dbFilename: 'fam.db' },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });
  return familyDb;
}

function makeRequest(body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${FACTSHEET_ID}/repromote-force`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

const PARAMS = Promise.resolve({ id: FACTSHEET_ID });

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/research/factsheets/:id/repromote-force', () => {
  // -------------------------------------------------------------------------
  // 1. Happy path (solo)
  // -------------------------------------------------------------------------

  it('happy path — returns 200 mode=force-repromoted with personId, oldPersonId, diff', async () => {
    const db = authSuccess();

    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'no' });
    vi.mocked(computePatchDiff).mockResolvedValue(MOCK_DIFF);
    vi.mocked(hashPatchDiff).mockReturnValue(CORRECT_HASH);
    vi.mocked(_unmergeFactsheetInTransaction).mockResolvedValue({
      personId: OLD_PERSON_ID,
      promotedAt: '2026-05-24T00:00:00.000Z',
      deleted: { persons: 1, events: 2, names: 1, sources: 1, citations: 1 },
    });
    vi.mocked(_promoteSingleFactsheetInTransaction).mockResolvedValue({
      personId: NEW_PERSON_ID,
      eventsCreated: 2,
      sourcesCreated: 1,
      mode: 'created',
    });

    const res = await POST(
      makeRequest({ reason: 'discard edits and re-promote', diffHash: CORRECT_HASH }),
      { params: PARAMS },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('force-repromoted');
    expect(body.personId).toBe(NEW_PERSON_ID);
    expect(body.oldPersonId).toBe(OLD_PERSON_ID);
    expect(body.diff).toEqual(MOCK_DIFF);

    // Both inner helpers must be called
    expect(vi.mocked(_unmergeFactsheetInTransaction)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ factsheetId: FACTSHEET_ID }),
    );
    expect(vi.mocked(_promoteSingleFactsheetInTransaction)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        factsheetId: FACTSHEET_ID,
        mode: 'create',
        skipValidation: true,
        userId: 'u1',
      }),
      expect.any(String), // now ISO string
    );

    // Audit event written inside the transaction
    expect(vi.mocked(logReverseEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'factsheet_force_repromoted',
        reason: 'discard edits and re-promote',
        actorId: 'u1',
        factsheetId: FACTSHEET_ID,
        personId: NEW_PERSON_ID,
        payload: expect.objectContaining({ oldPersonId: OLD_PERSON_ID, newPersonId: NEW_PERSON_ID }),
      }),
    );

    // Cluster-member swap path must NOT have fired
    expect(vi.mocked(_forceRepromoteClusterMemberInTransaction)).not.toHaveBeenCalled();

    // Transaction pattern: BEGIN IMMEDIATE + COMMIT
    const runCalls = vi.mocked(db.run).mock.calls.map(([q]) =>
      ((q as unknown as { queryChunks?: Array<{ value?: string[] }> }).queryChunks?.[0]?.value?.[0] ?? '').toUpperCase()
    );
    expect(runCalls.some((s) => s.includes('BEGIN IMMEDIATE'))).toBe(true);
    expect(runCalls.some((s) => s.includes('COMMIT'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Stale diffHash → 409 StaleDiff with currentDiff + currentDiffHash
  // -------------------------------------------------------------------------

  it('stale diffHash → 409 StaleDiff with currentDiff + currentDiffHash', async () => {
    authSuccess();

    const freshHash = 'b'.repeat(64);
    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'no' });
    vi.mocked(computePatchDiff).mockResolvedValue(MOCK_DIFF);
    vi.mocked(hashPatchDiff).mockReturnValue(freshHash);

    const res = await POST(
      makeRequest({ reason: 'discard edits', diffHash: 'c'.repeat(64) }),
      { params: PARAMS },
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('StaleDiff');
    expect(body.currentDiff).toEqual(MOCK_DIFF);
    expect(body.currentDiffHash).toBe(freshHash);
    expect(body.message).toBeDefined();

    // Inner helpers must NOT be called
    expect(vi.mocked(_unmergeFactsheetInTransaction)).not.toHaveBeenCalled();
    expect(vi.mocked(_promoteSingleFactsheetInTransaction)).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Bundle D Task 11: Cluster-member surgical swap → 200 with clusterMember:true
  // -------------------------------------------------------------------------

  it('cluster member (precise) → 200 surgical swap response shape with clusterMember:true', async () => {
    // The route fetches promoted_person_id via familyDb.all() for the cluster-
    // member branch — seed the mock DB with the old person id.
    const db = makeFamilyDb([{ promoted_person_id: OLD_PERSON_ID }]);
    authSuccess(db);

    vi.mocked(getClusterMembership).mockResolvedValue({
      kind: 'precise',
      clusterPromotionId: CLUSTER_PROMOTION_ID,
    });
    vi.mocked(_forceRepromoteClusterMemberInTransaction).mockResolvedValue({
      factsheetId: FACTSHEET_ID,
      previousPersonId: OLD_PERSON_ID,
      personId: NEW_PERSON_ID,
      clusterPromotionId: CLUSTER_PROMOTION_ID,
    });

    const res = await POST(
      makeRequest({ reason: 'force refresh cluster member', diffHash: CORRECT_HASH }),
      { params: PARAMS },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.factsheetId).toBe(FACTSHEET_ID);
    expect(body.personId).toBe(NEW_PERSON_ID);
    expect(body.previousPersonId).toBe(OLD_PERSON_ID);
    expect(body.clusterMember).toBe(true);

    // Surgical-swap helper invoked with the right shape
    expect(vi.mocked(_forceRepromoteClusterMemberInTransaction)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        factsheetId: FACTSHEET_ID,
        clusterPromotionId: CLUSTER_PROMOTION_ID,
        personIdOld: OLD_PERSON_ID,
        actorId: 'u1',
        reason: 'force refresh cluster member',
      }),
      expect.any(String),
    );

    // Solo helpers must NOT have been called on the cluster path
    expect(vi.mocked(_unmergeFactsheetInTransaction)).not.toHaveBeenCalled();
    expect(vi.mocked(_promoteSingleFactsheetInTransaction)).not.toHaveBeenCalled();
    // Cluster guard fires first — computePatchDiff is part of the solo path only.
    expect(vi.mocked(computePatchDiff)).not.toHaveBeenCalled();

    // Audit event written inside the cluster-member outer transaction with
    // the cluster-specific payload shape (`clusterMember: true`).
    expect(vi.mocked(logReverseEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'factsheet_force_repromoted',
        reason: 'force refresh cluster member',
        actorId: 'u1',
        factsheetId: FACTSHEET_ID,
        personId: NEW_PERSON_ID,
        payload: expect.objectContaining({
          previousPersonId: OLD_PERSON_ID,
          clusterPromotionId: CLUSTER_PROMOTION_ID,
          clusterMember: true,
        }),
      }),
    );

    // Transaction pattern: BEGIN IMMEDIATE + COMMIT in the cluster path
    const runCalls = vi.mocked(db.run).mock.calls.map(([q]) =>
      ((q as unknown as { queryChunks?: Array<{ value?: string[] }> }).queryChunks?.[0]?.value?.[0] ?? '').toUpperCase()
    );
    expect(runCalls.some((s) => s.includes('BEGIN IMMEDIATE'))).toBe(true);
    expect(runCalls.some((s) => s.includes('COMMIT'))).toBe(true);

    // Cache invalidation includes inbox-count('max') on the cluster path
    const tags = vi.mocked(revalidateTag).mock.calls.map(([t]) => t);
    expect(tags).toContain('inbox-count');
    expect(tags).toContain(`factsheet-${FACTSHEET_ID}`);
    for (const [, second] of vi.mocked(revalidateTag).mock.calls) {
      expect(second).toBe('max');
    }
  });

  // -------------------------------------------------------------------------
  // 4. Bundle D Task 11: Cluster-member with no promoted_person_id → 422
  // (defensive — shouldn't happen since cluster_promotion_id is co-written)
  // -------------------------------------------------------------------------

  it('cluster member but factsheet has no promoted_person_id → 422 FactsheetNotPromoted', async () => {
    const db = makeFamilyDb([{ promoted_person_id: null }]);
    authSuccess(db);

    vi.mocked(getClusterMembership).mockResolvedValue({
      kind: 'precise',
      clusterPromotionId: CLUSTER_PROMOTION_ID,
    });

    const res = await POST(
      makeRequest({ reason: 'force', diffHash: CORRECT_HASH }),
      { params: PARAMS },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('FactsheetNotPromoted');

    expect(vi.mocked(_forceRepromoteClusterMemberInTransaction)).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 5. Bundle D Task 11: Legacy cluster → 422 LegacyClusterNotSupported
  // -------------------------------------------------------------------------

  it('legacy cluster → 422 LegacyClusterNotSupported', async () => {
    authSuccess();
    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'legacy' });

    const res = await POST(
      makeRequest({ reason: 'force', diffHash: CORRECT_HASH }),
      { params: PARAMS },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('LegacyClusterNotSupported');

    // Neither swap nor solo paths fire on legacy refusal
    expect(vi.mocked(_forceRepromoteClusterMemberInTransaction)).not.toHaveBeenCalled();
    expect(vi.mocked(_unmergeFactsheetInTransaction)).not.toHaveBeenCalled();
    expect(vi.mocked(computePatchDiff)).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 6. Missing reason → 400 reason-required
  // -------------------------------------------------------------------------

  it('missing reason → 400 reason-required', async () => {
    authSuccess();

    const res = await POST(
      makeRequest({ diffHash: 'a'.repeat(64) }),
      { params: PARAMS },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // 7. Missing diffHash → 400 with diffHash error message
  // -------------------------------------------------------------------------

  it('missing diffHash → 400 with diffHash validation error', async () => {
    authSuccess();

    const res = await POST(
      makeRequest({ reason: 'discard edits' }),
      { params: PARAMS },
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/diffHash/i);
  });

  // -------------------------------------------------------------------------
  // 8. revalidateTag includes inbox-count with 'max' (solo path)
  // -------------------------------------------------------------------------

  it('calls revalidateTag inbox-count with "max" on success', async () => {
    authSuccess();

    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'no' });
    vi.mocked(computePatchDiff).mockResolvedValue(MOCK_DIFF);
    vi.mocked(hashPatchDiff).mockReturnValue(CORRECT_HASH);
    vi.mocked(_unmergeFactsheetInTransaction).mockResolvedValue({
      personId: OLD_PERSON_ID,
      promotedAt: '2026-05-24T00:00:00.000Z',
      deleted: { persons: 1, events: 0, names: 1, sources: 0, citations: 0 },
    });
    vi.mocked(_promoteSingleFactsheetInTransaction).mockResolvedValue({
      personId: NEW_PERSON_ID,
      eventsCreated: 0,
      sourcesCreated: 0,
      mode: 'created',
    });

    const res = await POST(
      makeRequest({ reason: 'discard edits and re-promote', diffHash: CORRECT_HASH }),
      { params: PARAMS },
    );
    expect(res.status).toBe(200);

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain('inbox-count');
    // All revalidateTag calls must use 'max' as the second arg
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });

  // -------------------------------------------------------------------------
  // ClusterMemberUseClusterUnmergeError thrown from inner helper — cluster guard should prevent this
  // -------------------------------------------------------------------------

  it('ClusterMemberUseClusterUnmergeError thrown from inner helper → 500 (not caught at route level)', async () => {
    authSuccess();

    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'no' });
    vi.mocked(computePatchDiff).mockResolvedValue(MOCK_DIFF);
    vi.mocked(hashPatchDiff).mockReturnValue(CORRECT_HASH);
    vi.mocked(_unmergeFactsheetInTransaction).mockRejectedValue(
      new ClusterMemberUseClusterUnmergeError(FACTSHEET_ID, 'cp-1'),
    );

    const res = await POST(
      makeRequest({ reason: 'force-repromote', diffHash: CORRECT_HASH }),
      { params: PARAMS },
    );

    // The repromote-force route has no handler for ClusterMemberUseClusterUnmergeError;
    // the cluster guard at the top prevents reaching unmerge for known clusters.
    // If somehow reached, it falls through to the generic 500 handler.
    expect(res.status).toBe(500);
  });
});
