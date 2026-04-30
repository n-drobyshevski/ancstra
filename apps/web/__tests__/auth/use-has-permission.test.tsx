// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHasPermission, useActiveMembership } from '@/lib/auth/use-has-permission';

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

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
