import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above all imports, so any variable they
// reference must be hoisted too. vi.hoisted() makes that explicit.
const { mockRedirect, mockRequireAuthContext } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string): never => {
    // Mirror next/navigation's behavior: redirect() never returns; it throws
    // a special error that the framework catches. Tests assert mock was called.
    throw new Error(`__REDIRECT__:${url}`);
  }),
  mockRequireAuthContext: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('@/lib/auth/context', () => ({
  requireAuthContext: () => mockRequireAuthContext(),
}));

import { requirePagePermission, requirePagePermissionAny } from '@/lib/auth/page-guard';

beforeEach(() => {
  mockRedirect.mockClear();
  mockRequireAuthContext.mockReset();
});

function ctx(role: 'owner' | 'admin' | 'editor' | 'viewer') {
  return {
    userId: 'u-1',
    familyId: 'fam-1',
    role,
    actualRole: role,
    dbFilename: 'fam-1.db',
  };
}

describe('requirePagePermission', () => {
  it('returns the auth context when the role holds the permission', async () => {
    mockRequireAuthContext.mockResolvedValue(ctx('admin'));
    const result = await requirePagePermission('person:edit');
    expect(result.role).toBe('admin');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects with ?denied= when the role lacks the permission', async () => {
    mockRequireAuthContext.mockResolvedValue(ctx('viewer'));
    await expect(requirePagePermission('person:edit')).rejects.toThrow('__REDIRECT__:/dashboard?denied=person%3Aedit');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard?denied=person%3Aedit');
  });

  it('uses the provided fallback path', async () => {
    mockRequireAuthContext.mockResolvedValue(ctx('editor'));
    await expect(
      requirePagePermission('members:manage', '/settings'),
    ).rejects.toThrow('__REDIRECT__:/settings?denied=members%3Amanage');
  });

  it('appends &denied= when the fallback already contains a query string', async () => {
    mockRequireAuthContext.mockResolvedValue(ctx('viewer'));
    await expect(
      requirePagePermission('person:edit', '/dashboard?from=tree'),
    ).rejects.toThrow('__REDIRECT__:/dashboard?from=tree&denied=person%3Aedit');
  });

  it('lens-aware: ctx.role being viewer (after lens) triggers redirect even though caller would be admin', async () => {
    // Simulates an admin who set a viewer lens — the cookie-aware getAuthContext
    // resolves ctx.role to 'viewer' even though the JWT role is 'admin'.
    mockRequireAuthContext.mockResolvedValue({ ...ctx('viewer'), actualRole: 'admin' });
    await expect(requirePagePermission('person:edit')).rejects.toThrow();
    expect(mockRedirect).toHaveBeenCalledOnce();
  });
});

describe('requirePagePermissionAny', () => {
  it('passes when the role holds at least one of the listed permissions', async () => {
    mockRequireAuthContext.mockResolvedValue(ctx('editor'));
    // editor has gedcom:export but not gedcom:import — should still pass.
    const result = await requirePagePermissionAny(['gedcom:import', 'gedcom:export']);
    expect(result.role).toBe('editor');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('redirects when the role holds none of the listed permissions', async () => {
    mockRequireAuthContext.mockResolvedValue(ctx('viewer'));
    await expect(
      requirePagePermissionAny(['gedcom:import', 'gedcom:export']),
    ).rejects.toThrow('__REDIRECT__:/dashboard?denied=gedcom%3Aimport');
  });
});
