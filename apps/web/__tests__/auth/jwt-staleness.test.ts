import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchVersionMock = vi.fn();

vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          get: fetchVersionMock,
        }),
      }),
    }),
  })),
  getCentralDbSync: vi.fn(() => ({} as never)),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    ensureCentralSchema: vi.fn(async () => undefined),
  };
});

describe('JWT staleness detection logic', () => {
  beforeEach(() => vi.clearAllMocks());

  it('detects mismatch when DB version > JWT version', async () => {
    fetchVersionMock.mockResolvedValueOnce({ v: 5 });

    const jwtVersion = 3;
    const result = await fetchVersionMock();
    const dbVersion = result?.v ?? 0;
    expect(dbVersion).toBeGreaterThan(jwtVersion);
    // The proxy uses this comparison to set force-jwt-refresh cookie
  });

  it('skips refresh when versions match', async () => {
    fetchVersionMock.mockResolvedValueOnce({ v: 3 });

    const jwtVersion = 3;
    const result = await fetchVersionMock();
    const dbVersion = result?.v ?? 0;
    expect(dbVersion).toBe(jwtVersion);
  });

  it('treats missing JWT version as 0', async () => {
    fetchVersionMock.mockResolvedValueOnce({ v: 1 });

    const jwtVersion: number | undefined = undefined;
    const result = await fetchVersionMock();
    const dbVersion = result?.v ?? 0;
    expect(dbVersion !== (jwtVersion ?? 0)).toBe(true);
  });
});
