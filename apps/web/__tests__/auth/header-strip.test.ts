import { describe, it, expect, vi } from 'vitest';
import { getAuthContext } from '@/lib/auth/context';

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({
    user: {
      id: 'u-viewer',
      memberships: [
        { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      ],
      membershipsVersion: 0,
    },
  })),
}));

vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(async () => ({} as never)),
  getCentralDbSync: vi.fn(() => ({} as never)),
}));

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createFamilyDb: vi.fn(() => ({} as never)),
    ensureCentralSchema: vi.fn(async () => undefined),
  };
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

// getAuthContext awaits next/server's `connection()` as a dynamic-signal marker
// (added in f9784657 for Next.js 16 cacheComponents). Outside a real request
// scope it throws; mock it to a no-op so unit tests can exercise the function.
vi.mock('next/server', () => ({
  connection: vi.fn(async () => undefined),
}));

describe('prerender bail-out resilience', () => {
  it('getAuthContext does not reject when connection() rejects (prerender bail-out)', async () => {
    const { connection } = await import('next/server');
    vi.mocked(connection).mockRejectedValueOnce(new Error('PRERENDER_BAIL'));

    // Provide a valid request so the rest of the auth flow can proceed.
    const ctx = await getAuthContext(
      new Request('http://localhost/', {
        headers: { 'x-user-id': 'u-viewer', 'x-family-id': 'f1', 'x-family-db': 'f1.db' },
      }),
    );

    // Must not propagate — valid context returned from JWT mock above.
    expect(ctx).not.toBeNull();
    expect(ctx!.userId).toBe('u-viewer');
  });
});

describe('header-strip / role re-derivation', () => {
  it('ignores forged x-family-role header — role comes from JWT', async () => {
    const forgedRequest = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': 'u-viewer',
        'x-family-id': 'f1',
        'x-family-db': 'f1.db',
        'x-family-role': 'admin', // forged
      },
    });

    const ctx = await getAuthContext(forgedRequest);
    expect(ctx).not.toBeNull();
    expect(ctx!.role).toBe('viewer'); // from JWT, NOT from header
    expect(ctx!.userId).toBe('u-viewer');
    expect(ctx!.familyId).toBe('f1');
  });

  it('returns null for requests without x-user-id', async () => {
    const request = new Request('http://localhost/api/test', { headers: {} });
    const ctx = await getAuthContext(request);
    expect(ctx).toBeNull();
  });
});
