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
    unmergeFactsheetCluster: vi.fn(),
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/research/factsheets/[id]/unmerge-cluster/route';
import { withAuth } from '@/lib/auth/api-guard';
import {
  unmergeFactsheetCluster,
  FactsheetNotPromotedAsClusterError,
  LegacyClusterNotSupportedError,
} from '@ancstra/research';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FACTSHEET_ID = 'fs-cluster-1';
const CLUSTER_UNMERGE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CLUSTER_PROMOTION_ID = 'cp-test-1';

const MOCK_FAMILY_DB = {} as ReturnType<typeof import('@ancstra/db')['createFamilyDb']>;

function authSuccess() {
  vi.mocked(withAuth).mockResolvedValue({
    familyDb: MOCK_FAMILY_DB,
    ctx: { userId: 'u1', familyId: 'fam1', role: 'editor', actualRole: 'editor', dbFilename: 'fam.db' },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });
}

function makeRequest(body: unknown) {
  return new Request(
    `http://localhost/api/research/factsheets/${FACTSHEET_ID}/unmerge-cluster`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

const PARAMS = Promise.resolve({ id: FACTSHEET_ID });

// UUID v4 shape regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/research/factsheets/:id/unmerge-cluster', () => {
  // -------------------------------------------------------------------------
  // 1. Happy path — memberCount === 3, clusterUnmergeId UUID-shaped
  // -------------------------------------------------------------------------

  it('200 happy path — returns memberCount and UUID-shaped clusterUnmergeId', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheetCluster).mockResolvedValue({
      memberCount: 3,
      clusterUnmergeId: CLUSTER_UNMERGE_ID,
      clusterPromotionId: CLUSTER_PROMOTION_ID,
    });

    const res = await POST(
      makeRequest({ reason: 'reversed cluster by mistake' }),
      { params: PARAMS },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.memberCount).toBe(3);
    expect(body.clusterUnmergeId).toMatch(UUID_RE);
    expect(body.clusterUnmergeId).toBe(CLUSTER_UNMERGE_ID);

    expect(vi.mocked(unmergeFactsheetCluster)).toHaveBeenCalledWith(
      MOCK_FAMILY_DB,
      expect.objectContaining({
        factsheetId: FACTSHEET_ID,
        reason: 'reversed cluster by mistake',
        actorId: 'u1',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // 2. 400 on missing reason
  // -------------------------------------------------------------------------

  it('400 on missing reason', async () => {
    authSuccess();
    const res = await POST(makeRequest({}), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  it('400 on empty string reason', async () => {
    authSuccess();
    const res = await POST(makeRequest({ reason: '' }), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // 3. 422 LegacyClusterNotSupported on heuristic-only cluster
  // -------------------------------------------------------------------------

  it('422 LegacyClusterNotSupported when LegacyClusterNotSupportedError is thrown', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheetCluster).mockRejectedValue(
      new LegacyClusterNotSupportedError(FACTSHEET_ID),
    );

    const res = await POST(
      makeRequest({ reason: 'try legacy cluster' }),
      { params: PARAMS },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('LegacyClusterNotSupported');
    expect(body.message).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 4. 422 FactsheetNotPromotedAsCluster on solo factsheet
  // -------------------------------------------------------------------------

  it('422 FactsheetNotPromotedAsCluster when FactsheetNotPromotedAsClusterError is thrown', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheetCluster).mockRejectedValue(
      new FactsheetNotPromotedAsClusterError(FACTSHEET_ID),
    );

    const res = await POST(
      makeRequest({ reason: 'try solo factsheet' }),
      { params: PARAMS },
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('FactsheetNotPromotedAsCluster');
    expect(body.message).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 5. revalidateTag('inbox-count', 'max') called after success
  // -------------------------------------------------------------------------

  it("calls revalidateTag('inbox-count', 'max') on success", async () => {
    authSuccess();
    vi.mocked(unmergeFactsheetCluster).mockResolvedValue({
      memberCount: 2,
      clusterUnmergeId: CLUSTER_UNMERGE_ID,
      clusterPromotionId: CLUSTER_PROMOTION_ID,
    });

    const res = await POST(
      makeRequest({ reason: 'inbox count flush test' }),
      { params: PARAMS },
    );
    expect(res.status).toBe(200);

    const calls = vi.mocked(revalidateTag).mock.calls;
    const inboxCall = calls.find(([tag]) => tag === 'inbox-count');
    expect(inboxCall).toBeDefined();
    expect(inboxCall![1]).toBe('max');

    // All revalidateTag calls must use 'max' as the second arg
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });

  it('does NOT call revalidateTag when unmergeFactsheetCluster throws', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheetCluster).mockRejectedValue(
      new FactsheetNotPromotedAsClusterError(FACTSHEET_ID),
    );

    await POST(makeRequest({ reason: 'will fail' }), { params: PARAMS });

    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 6. Audit rows share clusterUnmergeId — verify via mock return value
  //    (unmergeFactsheetCluster handles the audit internally; what the route
  //    can verify is that the clusterUnmergeId from the function return flows
  //    through to the response body unchanged)
  // -------------------------------------------------------------------------

  it('clusterUnmergeId from function return flows through unchanged to response body', async () => {
    authSuccess();
    const specificUnmergeId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    vi.mocked(unmergeFactsheetCluster).mockResolvedValue({
      memberCount: 3,
      clusterUnmergeId: specificUnmergeId,
      clusterPromotionId: CLUSTER_PROMOTION_ID,
    });

    const res = await POST(
      makeRequest({ reason: 'audit correlation test' }),
      { params: PARAMS },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clusterUnmergeId).toBe(specificUnmergeId);
    // The route strips clusterPromotionId from the response (implementation choice)
    // but memberCount and clusterUnmergeId are always present
    expect(body.memberCount).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 7. Unexpected errors are rethrown (let Next.js return 500)
  // -------------------------------------------------------------------------

  it('rethrows unexpected errors', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheetCluster).mockRejectedValue(new Error('db exploded'));

    await expect(
      POST(makeRequest({ reason: 'test' }), { params: PARAMS }),
    ).rejects.toThrow('db exploded');
  });
});
