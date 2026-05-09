import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

// `next/cache` directives are stripped at build time; the bare imports of
// cacheLife / cacheTag must succeed in tests as well.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

// In-memory chained-builder shim so the helper's drizzle .select().from().where()...
// pipeline returns whatever the test queues up via `mockMemberRows`.
const mockMemberRows: Array<{ role: string; count: number }> = [];
const buildSelectChain = () => ({
  from: () => ({
    where: () => ({
      groupBy: () => ({
        all: async () => mockMemberRows.slice(),
      }),
    }),
  }),
});
const mockCentralDb = { select: () => buildSelectChain() };
vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: () => Promise.resolve(mockCentralDb),
}));

const mockFamilyDb = {} as Record<string, unknown>;
vi.mock('@/lib/db', () => ({
  getFamilyDb: () => Promise.resolve(mockFamilyDb),
}));

const mockListInvites = vi.fn();
const mockGetPending = vi.fn();
vi.mock('@ancstra/auth', () => ({
  listFamilyInvitations: (...args: unknown[]) => mockListInvites(...args),
  getPendingContributions: (...args: unknown[]) => mockGetPending(...args),
}));

import {
  getCachedFamilyHealthSummary,
  getCachedModerationSummary,
} from '@/lib/cache/dashboard-heroes';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('getCachedFamilyHealthSummary', () => {
  beforeEach(() => {
    mockMemberRows.length = 0;
    mockListInvites.mockReset();
  });

  it('aggregates counts per role and total members', async () => {
    mockMemberRows.push(
      { role: 'owner', count: 1 },
      { role: 'admin', count: 2 },
      { role: 'editor', count: 5 },
      { role: 'viewer', count: 3 },
    );
    mockListInvites.mockResolvedValue([]);
    const result = await getCachedFamilyHealthSummary('fam-1');
    expect(result.totalMembers).toBe(11);
    expect(result.memberCounts).toEqual({ owner: 1, admin: 2, editor: 5, viewer: 3 });
  });

  it('zero-fills missing role buckets', async () => {
    mockMemberRows.push({ role: 'owner', count: 1 });
    mockListInvites.mockResolvedValue([]);
    const result = await getCachedFamilyHealthSummary('fam-1');
    expect(result.memberCounts).toEqual({ owner: 1, admin: 0, editor: 0, viewer: 0 });
    expect(result.totalMembers).toBe(1);
  });

  it('reflects pending invitation count', async () => {
    mockMemberRows.push({ role: 'owner', count: 1 });
    mockListInvites.mockResolvedValue([{}, {}, {}]);
    const result = await getCachedFamilyHealthSummary('fam-1');
    expect(result.pendingInviteCount).toBe(3);
  });

  it('queries pending invites for the right family with status: pending', async () => {
    mockMemberRows.push({ role: 'owner', count: 1 });
    mockListInvites.mockResolvedValue([]);
    await getCachedFamilyHealthSummary('fam-XYZ');
    expect(mockListInvites).toHaveBeenCalledWith(
      mockCentralDb,
      'fam-XYZ',
      { status: 'pending' },
    );
  });
});

describe('getCachedModerationSummary', () => {
  beforeEach(() => {
    mockGetPending.mockReset();
    vi.useRealTimers();
  });

  it('returns zero state when queue is empty', async () => {
    mockGetPending.mockResolvedValue([]);
    const result = await getCachedModerationSummary('fam.db');
    expect(result).toEqual({ pendingCount: 0, oldestAgeDays: null, byEntityType: [] });
  });

  it('counts items, derives oldestAgeDays, and groups by entityType', async () => {
    // Pin "now" so the age math is deterministic.
    const now = new Date('2026-05-09T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const dayMs = 24 * 60 * 60 * 1000;
    mockGetPending.mockResolvedValue([
      // 5 days old, person
      { entityType: 'person', createdAt: new Date(now.getTime() - 5 * dayMs).toISOString() },
      // 2 days old, person
      { entityType: 'person', createdAt: new Date(now.getTime() - 2 * dayMs).toISOString() },
      // 1 day old, event
      { entityType: 'event', createdAt: new Date(now.getTime() - 1 * dayMs).toISOString() },
      // 0.5 day old, family
      { entityType: 'family', createdAt: new Date(now.getTime() - 0.5 * dayMs).toISOString() },
    ]);

    const result = await getCachedModerationSummary('fam.db');
    expect(result.pendingCount).toBe(4);
    expect(result.oldestAgeDays).toBe(5);
    // Sorted by count desc; persons:2, then event:1, family:1 (stable order is allowed).
    expect(result.byEntityType[0]).toEqual({ entityType: 'person', count: 2 });
    expect(result.byEntityType.length).toBe(3);
    expect(result.byEntityType.find((e) => e.entityType === 'event')?.count).toBe(1);
    expect(result.byEntityType.find((e) => e.entityType === 'family')?.count).toBe(1);
  });

  it('floors fractional days for oldestAgeDays', async () => {
    const now = new Date('2026-05-09T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    mockGetPending.mockResolvedValue([
      { entityType: 'source', createdAt: sixHoursAgo.toISOString() },
    ]);
    const result = await getCachedModerationSummary('fam.db');
    expect(result.oldestAgeDays).toBe(0);
  });
});
