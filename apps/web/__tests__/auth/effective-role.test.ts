import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthContext } from '@/lib/auth/context';

const mockGetAuthContext = vi.fn<() => Promise<AuthContext | null>>();
vi.mock('@/lib/auth/context', () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

import { getEffectiveRole, getActualRole } from '@/lib/auth/effective-role';

const baseCtx: AuthContext = {
  userId: 'u1',
  familyId: 'fam-1',
  role: 'editor',
  actualRole: 'admin',
  dbFilename: 'fam-1.db',
};

describe('getEffectiveRole / getActualRole', () => {
  beforeEach(() => {
    mockGetAuthContext.mockReset();
  });

  it('returns the effective (lens-aware) role from auth context', async () => {
    mockGetAuthContext.mockResolvedValue(baseCtx);
    await expect(getEffectiveRole()).resolves.toBe('editor');
  });

  it('returns the untouched actual role from auth context', async () => {
    mockGetAuthContext.mockResolvedValue(baseCtx);
    await expect(getActualRole()).resolves.toBe('admin');
  });

  it('returns null when there is no auth context', async () => {
    mockGetAuthContext.mockResolvedValue(null);
    await expect(getEffectiveRole()).resolves.toBeNull();
    await expect(getActualRole()).resolves.toBeNull();
  });

  it('effective and actual roles match when no lens is active', async () => {
    mockGetAuthContext.mockResolvedValue({ ...baseCtx, role: 'admin', actualRole: 'admin' });
    await expect(getEffectiveRole()).resolves.toBe('admin');
    await expect(getActualRole()).resolves.toBe('admin');
  });

  it('viewer lens correctly downgrades from owner', async () => {
    mockGetAuthContext.mockResolvedValue({ ...baseCtx, role: 'viewer', actualRole: 'owner' });
    await expect(getEffectiveRole()).resolves.toBe('viewer');
    await expect(getActualRole()).resolves.toBe('owner');
  });
});
