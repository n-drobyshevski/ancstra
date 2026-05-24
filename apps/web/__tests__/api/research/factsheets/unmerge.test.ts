import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// Pattern matches apps/web/__tests__/api/transfer-ownership.test.ts.
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
    unmergeFactsheet: vi.fn(),
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/research/factsheets/[id]/unmerge/route';
import { withAuth } from '@/lib/auth/api-guard';
import {
  unmergeFactsheet,
  FactsheetNotPromotedError,
  PersonDirtyError,
  ClusterPromotedError,
  ReasonRequiredError,
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
  return new Request('http://localhost/api/research/factsheets/fs-1/unmerge', {
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

describe('POST /api/research/factsheets/:id/unmerge', () => {
  // -------------------------------------------------------------------------
  // reason validation
  // -------------------------------------------------------------------------

  it('returns 400 with error=reason-required when reason is empty string', async () => {
    authSuccess();
    const res = await POST(makeRequest({ reason: '' }), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  it('returns 400 with error=reason-required when body is missing reason', async () => {
    authSuccess();
    const res = await POST(makeRequest({}), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  it('returns 400 with error=reason-required when body is whitespace only', async () => {
    authSuccess();
    const res = await POST(makeRequest({ reason: '   ' }), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // domain error paths
  // -------------------------------------------------------------------------

  it('returns 400 with error=dirty when PersonDirtyError is thrown', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheet).mockRejectedValue(new PersonDirtyError('p-dirty'));
    const res = await POST(makeRequest({ reason: 'wrong person' }), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('dirty');
    expect(body.message).toContain('edited since promotion');
  });

  it('returns 400 with error=cluster-promoted when ClusterPromotedError is thrown', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheet).mockRejectedValue(new ClusterPromotedError('fs-1'));
    const res = await POST(makeRequest({ reason: 'wrong cluster' }), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('cluster-promoted');
  });

  it('returns 400 with error=not-promoted when FactsheetNotPromotedError is thrown', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheet).mockRejectedValue(new FactsheetNotPromotedError('fs-1'));
    const res = await POST(makeRequest({ reason: 'mistake' }), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('not-promoted');
  });

  // -------------------------------------------------------------------------
  // happy path
  // -------------------------------------------------------------------------

  it('returns 200 + revalidates expected tags on clean unmerge', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheet).mockResolvedValue({
      deleted: { persons: 1, events: 2, names: 1, sources: 1, citations: 1 },
    });
    const res = await POST(makeRequest({ reason: 'wrong person' }), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deleted.persons).toBe(1);

    const tags = vi.mocked(revalidateTag).mock.calls.map(([tag]) => tag);
    expect(tags).toContain('inbox-count');
    expect(tags).toContain('factsheets-list');
    expect(tags).toContain('persons');
    expect(tags).toContain('tree-data');
    expect(tags).toContain('dashboard-stats');
    expect(tags).toContain('factsheet-count');
    expect(tags).toContain('factsheet-fs-1');
    // Verify all revalidateTag calls use the 'max' second argument
    for (const [, second] of vi.mocked(revalidateTag).mock.calls) {
      expect(second).toBe('max');
    }
  });

  it('passes factsheetId + reason + actorId + threadId to unmergeFactsheet', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheet).mockResolvedValue({
      deleted: { persons: 1, events: 0, names: 1, sources: 0, citations: 0 },
    });
    await POST(makeRequest({ reason: '  trimmed reason  ' }), { params: PARAMS });
    expect(vi.mocked(unmergeFactsheet)).toHaveBeenCalledWith(
      MOCK_FAMILY_DB,
      expect.objectContaining({
        factsheetId: 'fs-1',
        reason: 'trimmed reason',  // requireReason trims whitespace
        actorId: 'u1',
      }),
    );
  });

  // -------------------------------------------------------------------------
  // unexpected errors fall through to 500
  // -------------------------------------------------------------------------

  it('returns 500 for unexpected errors', async () => {
    authSuccess();
    vi.mocked(unmergeFactsheet).mockRejectedValue(new Error('db crashed'));
    const res = await POST(makeRequest({ reason: 'test' }), { params: PARAMS });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('db crashed');
  });
});
