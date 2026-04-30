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
