// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { InviteAcceptedToast } from '@/components/dashboard/invite-accepted-toast';
import React from 'react';

// ── sonner toast ──────────────────────────────────────────────────────────────
const mockToastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}));

// ── next-auth ─────────────────────────────────────────────────────────────────
const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

// ── next/navigation ───────────────────────────────────────────────────────────
const mockRouterReplace = vi.fn();
const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => mockSearchParams(),
}));

// ── tRPC client ───────────────────────────────────────────────────────────────
const mockListMineUseQuery = vi.fn();
vi.mock('@/lib/trpc/client', () => ({
  trpc: {
    family: {
      listMine: {
        useQuery: () => mockListMineUseQuery(),
      },
    },
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────
function makeSession(familyId: string) {
  return {
    data: {
      user: {
        id: 'u1',
        memberships: [{ familyId, role: 'editor', dbFilename: `${familyId}.db` }],
        membershipsVersion: 0,
      },
      expires: '2099-01-01',
    },
    status: 'authenticated' as const,
    update: vi.fn(),
  };
}

describe('<InviteAcceptedToast>', () => {
  beforeEach(() => {
    mockToastSuccess.mockReset();
    mockRouterReplace.mockReset();
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    mockListMineUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it('fires toast.success once and cleans URL when ?invite=accepted is present', () => {
    const params = new URLSearchParams('family=f1&invite=accepted');
    mockSearchParams.mockReturnValue(params);
    mockUseSession.mockReturnValue(makeSession('f1'));
    mockListMineUseQuery.mockReturnValue({
      data: [{ id: 'f1', name: 'Smith Family', role: 'editor' }],
      isLoading: false,
    });

    render(<InviteAcceptedToast />);

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('Welcome to Smith Family');

    // URL replace is called with invite param stripped
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    const replacedUrl: string = mockRouterReplace.mock.calls[0][0];
    expect(replacedUrl).not.toContain('invite=accepted');
    expect(replacedUrl).toContain('family=f1');
  });

  it('fires generic toast when family name is not found', () => {
    const params = new URLSearchParams('invite=accepted');
    mockSearchParams.mockReturnValue(params);
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    mockListMineUseQuery.mockReturnValue({ data: [], isLoading: false });

    render(<InviteAcceptedToast />);

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith('Welcome to your new family');
  });

  it('does NOT fire toast when ?invite param is absent', () => {
    const params = new URLSearchParams('family=f1');
    mockSearchParams.mockReturnValue(params);
    mockUseSession.mockReturnValue(makeSession('f1'));
    mockListMineUseQuery.mockReturnValue({
      data: [{ id: 'f1', name: 'Smith Family', role: 'editor' }],
      isLoading: false,
    });

    render(<InviteAcceptedToast />);

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('does NOT fire toast while families query is still loading', () => {
    const params = new URLSearchParams('family=f1&invite=accepted');
    mockSearchParams.mockReturnValue(params);
    mockUseSession.mockReturnValue(makeSession('f1'));
    mockListMineUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<InviteAcceptedToast />);

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
