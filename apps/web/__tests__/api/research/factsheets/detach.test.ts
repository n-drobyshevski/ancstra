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
    softDetachFactsheet: vi.fn(),
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/research/factsheets/[id]/detach/route';
import { withAuth } from '@/lib/auth/api-guard';
import {
  softDetachFactsheet,
  FactsheetNotPromotedError,
  ClusterDetachNotSupportedError,
  LegacyClusterNotSupportedError,
} from '@ancstra/research';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_FAMILY_DB = {} as ReturnType<typeof import('@ancstra/db')['createFamilyDb']>;

function authSuccess() {
  vi.mocked(withAuth).mockResolvedValue({
    familyDb: MOCK_FAMILY_DB,
    ctx: { userId: 'u1', familyId: 'fam1', role: 'editor', actualRole: 'editor', dbFilename: 'fam.db' },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/research/factsheets/fs-1/detach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const PARAMS = Promise.resolve({ id: 'fs-1' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/research/factsheets/:id/detach', () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('returns 200 with factsheetId + previousPersonId on successful detach', async () => {
    authSuccess();
    vi.mocked(softDetachFactsheet).mockResolvedValue({
      factsheetId: 'fs-1',
      previousPersonId: 'person-42',
    });
    const res = await POST(makeRequest({ reason: 'breaking link' }), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.factsheetId).toBe('fs-1');
    expect(body.previousPersonId).toBe('person-42');
    expect(vi.mocked(softDetachFactsheet)).toHaveBeenCalledWith(
      MOCK_FAMILY_DB,
      expect.objectContaining({
        factsheetId: 'fs-1',
        reason: 'breaking link',
        actorId: 'u1',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Domain error paths
  // -------------------------------------------------------------------------

  it('returns 422 with error=FactsheetNotPromoted when FactsheetNotPromotedError is thrown', async () => {
    authSuccess();
    vi.mocked(softDetachFactsheet).mockRejectedValue(new FactsheetNotPromotedError('fs-1'));
    const res = await POST(makeRequest({ reason: 'mistake' }), { params: PARAMS });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('FactsheetNotPromoted');
    expect(body.message).toBeDefined();
  });

  it('returns 422 with error=ClusterUnsupported when ClusterDetachNotSupportedError is thrown', async () => {
    authSuccess();
    vi.mocked(softDetachFactsheet).mockRejectedValue(new ClusterDetachNotSupportedError('fs-1', 'cp-1'));
    const res = await POST(makeRequest({ reason: 'wrong cluster' }), { params: PARAMS });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('ClusterUnsupported');
  });

  it('returns 422 with error=ClusterUnsupported when LegacyClusterNotSupportedError is thrown', async () => {
    authSuccess();
    vi.mocked(softDetachFactsheet).mockRejectedValue(new LegacyClusterNotSupportedError('fs-1'));
    const res = await POST(makeRequest({ reason: 'legacy cluster' }), { params: PARAMS });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('ClusterUnsupported');
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  it('returns 400 with error=reason-required when body is missing reason', async () => {
    authSuccess();
    const res = await POST(makeRequest({}), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // Cache revalidation
  // -------------------------------------------------------------------------

  it('calls revalidateTag with (inbox-count, max) on success', async () => {
    authSuccess();
    vi.mocked(softDetachFactsheet).mockResolvedValue({
      factsheetId: 'fs-1',
      previousPersonId: 'person-42',
    });
    await POST(makeRequest({ reason: 'breaking link' }), { params: PARAMS });

    const calls = vi.mocked(revalidateTag).mock.calls;
    const inboxCall = calls.find(([tag]) => tag === 'inbox-count');
    expect(inboxCall).toBeDefined();
    expect(inboxCall![1]).toBe('max');

    // All revalidateTag calls must use 'max' as the second arg
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });
});
