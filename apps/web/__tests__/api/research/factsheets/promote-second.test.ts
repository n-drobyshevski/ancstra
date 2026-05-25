import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock layers — must come before any import of the module under test.
// Pattern matches apps/web/__tests__/api/research/factsheets/unmerge.test.ts.
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
    promoteSingleFactsheet: vi.fn(),
    promoteFactsheetCluster: vi.fn(),
    getClusterMembership: vi.fn(async () => ({ kind: 'no' as const })),
    isPersonDirtySincePromote: vi.fn(async () => false),
    computePatchDiff: vi.fn(),
    applyPatchDiff: vi.fn(async () => ({ eventsAdded: 0, eventsModified: 0, citationsAdded: 0 })),
    logReverseEvent: vi.fn(async () => 'evt-1'),
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ---------------------------------------------------------------------------
// Import the module under test and the mocked helpers AFTER vi.mock calls.
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/research/factsheets/[id]/promote/route';
import { withAuth } from '@/lib/auth/api-guard';
import {
  promoteSingleFactsheet,
  promoteFactsheetCluster,
  getClusterMembership,
  isPersonDirtySincePromote,
  computePatchDiff,
  applyPatchDiff,
  logReverseEvent,
  hashPatchDiff,
  LegacyPromotionNotPatchableError,
  type PatchDiff,
} from '@ancstra/research';
import { revalidateTag } from 'next/cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FACTSHEET_ID = 'fs-1';
const PERSON_ID = 'p-1';
const PROMOTED_AT = '2026-05-24T00:00:00.000Z';

/**
 * Builds a minimal stand-in for the family Drizzle DB. Route reads factsheet
 * state via `familyDb.all(sql\`SELECT status, promoted_person_id ...\`)`. We
 * stub `all` to return a queue of rows and `run` to no-op (for BEGIN/COMMIT).
 */
function makeFamilyDb(rowQueue: Array<Array<Record<string, unknown>>>) {
  const queue = [...rowQueue];
  return {
    all: vi.fn(async () => queue.shift() ?? []),
    run: vi.fn(async () => ({ changes: 0, rowsAffected: 0 })),
  } as unknown as ReturnType<typeof import('@ancstra/db')['createFamilyDb']>;
}

function authSuccess(familyDb: ReturnType<typeof makeFamilyDb>) {
  vi.mocked(withAuth).mockResolvedValue({
    familyDb,
    ctx: { userId: 'u1', familyId: 'fam1', role: 'editor', actualRole: 'editor', dbFilename: 'fam.db' },
    centralDb: {} as ReturnType<typeof import('@ancstra/db')['createCentralDb']>,
  });
}

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/research/factsheets/${FACTSHEET_ID}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const PARAMS = Promise.resolve({ id: FACTSHEET_ID });

function makeDiff(overrides: Partial<PatchDiff> = {}): PatchDiff {
  return {
    factsheetId: FACTSHEET_ID,
    personId: PERSON_ID,
    events: { added: [], modified: [], unchanged: [] },
    citations: { added: [], unchanged: [] },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/research/factsheets/:id/promote (auto-detect)', () => {
  // -------------------------------------------------------------------------
  // 1. first-promote → 200 mode=first with personId
  // -------------------------------------------------------------------------

  it('first-promote (ready) returns 200 mode=first with personId', async () => {
    const db = makeFamilyDb([
      [{ status: 'ready', promoted_person_id: null }], // factsheet read
    ]);
    authSuccess(db);
    vi.mocked(promoteSingleFactsheet).mockResolvedValue({
      personId: PERSON_ID,
      eventsCreated: 2,
      sourcesCreated: 1,
      mode: 'created',
    });

    const res = await POST(makeRequest({ reason: 'first promote' }), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('first');
    expect(body.personId).toBe(PERSON_ID);
    expect(body.eventsCreated).toBe(2);
    expect(body.sourcesCreated).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 2. second-promote on clean → 200 mode=patched with diff
  // -------------------------------------------------------------------------

  it('second-promote on clean returns 200 mode=patched with diff', async () => {
    const diff = makeDiff({
      events: {
        added: [
          { eventType: 'birth', dateOriginal: '1900', dateSort: 19000000, placeText: 'NYC', description: null },
        ],
        modified: [],
        unchanged: [],
      },
    });
    const db = makeFamilyDb([
      [{ status: 'promoted', promoted_person_id: PERSON_ID }], // factsheet status read
      [{ promoted_at: PROMOTED_AT }], // promoted_at for dirty check
    ]);
    authSuccess(db);
    vi.mocked(computePatchDiff).mockResolvedValue(diff);
    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'no' });
    vi.mocked(isPersonDirtySincePromote).mockResolvedValue(false);
    vi.mocked(applyPatchDiff).mockResolvedValue({
      eventsAdded: 1, eventsModified: 0, citationsAdded: 0,
    });

    const res = await POST(makeRequest({ reason: 'apply refinement' }), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe('patched');
    expect(body.personId).toBe(PERSON_ID);
    expect(body.diff).toEqual(diff);
    expect(body.eventsAdded).toBe(1);

    // Audit event logged inside transaction
    expect(vi.mocked(logReverseEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'factsheet_patched',
        reason: 'apply refinement',
        actorId: 'u1',
        factsheetId: FACTSHEET_ID,
        personId: PERSON_ID,
      }),
    );

    // BEGIN IMMEDIATE + COMMIT pattern
    const runCalls = vi.mocked(db.run).mock.calls.map(([q]) =>
      ((q as unknown as { queryChunks?: Array<{ value?: string[] }> }).queryChunks?.[0]?.value?.[0] ?? '').toUpperCase()
    );
    expect(runCalls.some((s) => s.includes('BEGIN IMMEDIATE'))).toBe(true);
    expect(runCalls.some((s) => s.includes('COMMIT'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. second-promote on dirty → 409 PersonDirty with diff + diffHash
  // -------------------------------------------------------------------------

  it('second-promote on dirty returns 409 PersonDirty with diff + diffHash', async () => {
    const diff = makeDiff({
      events: {
        added: [],
        modified: [
          {
            eventId: 'e-1', eventType: 'birth',
            deltas: [{ field: 'placeText', before: 'NYC', after: 'Brooklyn' }],
          },
        ],
        unchanged: [],
      },
    });
    const db = makeFamilyDb([
      [{ status: 'promoted', promoted_person_id: PERSON_ID }],
      [{ promoted_at: PROMOTED_AT }],
    ]);
    authSuccess(db);
    vi.mocked(computePatchDiff).mockResolvedValue(diff);
    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'no' });
    vi.mocked(isPersonDirtySincePromote).mockResolvedValue(true);

    const res = await POST(makeRequest({ reason: 'refine' }), { params: PARAMS });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('PersonDirty');
    expect(body.personId).toBe(PERSON_ID);
    expect(body.diff).toEqual(diff);
    expect(body.diffHash).toMatch(/^[0-9a-f]{64}$/);
    // Hash must match server-side canonical hash
    expect(body.diffHash).toBe(hashPatchDiff(diff));
  });

  // -------------------------------------------------------------------------
  // 4. cluster factsheet → 422 ClusterUnsupported
  // -------------------------------------------------------------------------

  it('promoted cluster factsheet returns 422 ClusterUnsupported', async () => {
    const db = makeFamilyDb([
      [{ status: 'promoted', promoted_person_id: PERSON_ID }],
    ]);
    authSuccess(db);
    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'precise', clusterPromotionId: 'cp-1' });

    const res = await POST(makeRequest({ reason: 're-promote' }), { params: PARAMS });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('ClusterUnsupported');
  });

  // -------------------------------------------------------------------------
  // 5. legacy promoted (LegacyPromotionNotPatchable) → 422
  // -------------------------------------------------------------------------

  it('legacy promotion (no source_factsheet_id on events) returns 422 LegacyPromotionNotPatchable', async () => {
    const db = makeFamilyDb([
      [{ status: 'promoted', promoted_person_id: PERSON_ID }],
    ]);
    authSuccess(db);
    vi.mocked(getClusterMembership).mockResolvedValue({ kind: 'no' });
    vi.mocked(computePatchDiff).mockRejectedValue(
      new LegacyPromotionNotPatchableError(FACTSHEET_ID),
    );

    const res = await POST(makeRequest({ reason: 're-promote' }), { params: PARAMS });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('LegacyPromotionNotPatchable');
  });

  // -------------------------------------------------------------------------
  // 6. merged factsheet → 422 FactsheetMergedNotSupported
  // -------------------------------------------------------------------------

  it('merged factsheet returns 422 FactsheetMergedNotSupported', async () => {
    const db = makeFamilyDb([
      [{ status: 'merged', promoted_person_id: PERSON_ID }],
    ]);
    authSuccess(db);

    const res = await POST(makeRequest({ reason: 're-promote' }), { params: PARAMS });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('FactsheetMergedNotSupported');
  });

  // -------------------------------------------------------------------------
  // 7. missing reason → 400 reason-required
  // -------------------------------------------------------------------------

  it('missing reason returns 400 reason-required', async () => {
    const db = makeFamilyDb([]);
    authSuccess(db);

    const res = await POST(makeRequest({}), { params: PARAMS });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('reason-required');
  });

  // -------------------------------------------------------------------------
  // 8. calls revalidateTag inbox-count on success
  // -------------------------------------------------------------------------

  it('calls revalidateTag inbox-count with "max" on success', async () => {
    const db = makeFamilyDb([
      [{ status: 'ready', promoted_person_id: null }],
    ]);
    authSuccess(db);
    vi.mocked(promoteSingleFactsheet).mockResolvedValue({
      personId: PERSON_ID,
      eventsCreated: 0,
      sourcesCreated: 0,
      mode: 'created',
    });

    const res = await POST(makeRequest({ reason: 'first promote' }), { params: PARAMS });
    expect(res.status).toBe(200);

    const calls = vi.mocked(revalidateTag).mock.calls;
    const tags = calls.map(([tag]) => tag);
    expect(tags).toContain('inbox-count');
    // Verify all revalidateTag calls use the 'max' second argument
    for (const [, second] of calls) {
      expect(second).toBe('max');
    }
  });

  // -------------------------------------------------------------------------
  // 9. preserves cluster-mode branch (body.cluster === true)
  // -------------------------------------------------------------------------

  it('cluster-mode branch (body.cluster === true) preserved on ready factsheet', async () => {
    const db = makeFamilyDb([]);
    authSuccess(db);
    vi.mocked(promoteFactsheetCluster).mockResolvedValue({
      personIds: [PERSON_ID, 'p-2'],
      eventsCreated: 3,
      familiesCreated: 1,
    } as unknown as Awaited<ReturnType<typeof promoteFactsheetCluster>>);

    const res = await POST(
      makeRequest({ reason: 'cluster promote', cluster: true }),
      { params: PARAMS },
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(promoteFactsheetCluster)).toHaveBeenCalledWith(
      db, FACTSHEET_ID, 'u1', null,
    );
  });
});
