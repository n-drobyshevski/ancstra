// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useHasPermission,
  useActiveMembership,
  useEffectiveRole,
  useHasAnyPermission,
} from '@/lib/auth/use-has-permission';

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

// useEffectiveMembership consumes useLens; the real provider would throw outside
// a <LensProvider>. Default to "no lens" so legacy tests behave as before.
const mockUseLens = vi.fn();
vi.mock('@/lib/lens/provider', () => ({
  useLens: () => mockUseLens(),
}));

beforeEach(() => {
  mockUseLens.mockReturnValue({
    actualRole: null,
    lens: null,
    setLens: vi.fn(),
    familyId: null,
  });
});

function makeSession(memberships: Array<{ familyId: string; role: string; dbFilename: string }>) {
  return {
    data: {
      user: {
        id: 'u1',
        memberships,
        membershipsVersion: 0,
      },
      expires: '2099-01-01',
    },
    status: 'authenticated' as const,
    update: vi.fn(),
  };
}

function makeParams(family?: string) {
  const params = new URLSearchParams();
  if (family) params.set('family', family);
  return params;
}

describe('useActiveMembership', () => {
  it('returns null when no session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current).toBeNull();
  });

  it('returns null when session has no memberships', () => {
    mockUseSession.mockReturnValue(makeSession([]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current).toBeNull();
  });

  it('uses explicit familyIdHint when provided', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership('f2'));
    expect(result.current?.familyId).toBe('f2');
    expect(result.current?.role).toBe('admin');
  });

  it('uses URL ?family= when no hint', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams('f2'));
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current?.familyId).toBe('f2');
  });

  it('falls back to memberships[0] when no hint and no URL param', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current?.familyId).toBe('f1');
  });
});

describe('useHasPermission', () => {
  it('returns false when no membership', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(false);
  });

  it('returns true for admin + person:edit', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'admin', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(true);
  });

  it('returns false for viewer + person:edit', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(false);
  });

  it('returns true for viewer + tree:view', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('tree:view'));
    expect(result.current).toBe(true);
  });

  it('returns false for editor + members:manage', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'editor', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('members:manage'));
    expect(result.current).toBe(false);
  });

  it('uses familyIdHint when provided', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit', 'f2'));
    expect(result.current).toBe(true);
  });
});

describe('useHasPermission with lens', () => {
  it('admin with viewer lens: person:edit becomes false', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'admin', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    mockUseLens.mockReturnValue({
      actualRole: 'admin',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(false);
  });

  it('owner with editor lens: person:edit stays true (editor can edit)', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'owner', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'editor',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(true);
  });

  it('owner with editor lens: members:manage becomes false', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'owner', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'editor',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { result } = renderHook(() => useHasPermission('members:manage'));
    expect(result.current).toBe(false);
  });

  it('lens for a different family is ignored', () => {
    // User is admin of f1; lens is set against f2 (a different family).
    // The lens must NOT apply to f1 — same-family check.
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'admin', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    mockUseLens.mockReturnValue({
      actualRole: 'admin',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'f2',
    });
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(true);
  });

  it('lens that requests escalation is ignored (downgrade-only)', () => {
    // Viewer trying to lens "as admin" — escalation is rejected by effectiveRole.
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    mockUseLens.mockReturnValue({
      actualRole: 'viewer',
      lens: 'admin',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(false);
  });
});

describe('useEffectiveRole', () => {
  it('returns null when no membership', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBeNull();
  });

  it('returns actual role when no lens active', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'admin', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('admin');
  });

  it('returns lens role when lens is a valid downgrade', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'admin', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    mockUseLens.mockReturnValue({
      actualRole: 'admin',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('viewer');
  });
});

describe('useHasAnyPermission', () => {
  it('returns true if at least one permission is held', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'editor', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() =>
      useHasAnyPermission(['members:manage', 'gedcom:export']),
    );
    expect(result.current).toBe(true); // editor has gedcom:export
  });

  it('returns false when none of the permissions are held', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() =>
      useHasAnyPermission(['members:manage', 'gedcom:import']),
    );
    expect(result.current).toBe(false);
  });

  it('honors lens (admin with viewer lens loses gedcom:export)', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'admin', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    mockUseLens.mockReturnValue({
      actualRole: 'admin',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { result } = renderHook(() =>
      useHasAnyPermission(['gedcom:export', 'members:manage']),
    );
    expect(result.current).toBe(false);
  });
});
