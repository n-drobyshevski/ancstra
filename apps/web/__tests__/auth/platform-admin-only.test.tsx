// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformAdminOnly } from '@/components/auth/platform-admin-only';

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockUseLens = vi.fn();
vi.mock('@/lib/lens/provider', () => ({
  useLens: () => mockUseLens(),
}));

function makeSession(isPlatformAdmin: boolean) {
  return {
    data: {
      user: {
        id: 'u1',
        memberships: [{ familyId: 'f1', role: 'admin', dbFilename: 'f1.db' }],
        membershipsVersion: 0,
        isPlatformAdmin,
      },
      expires: '2099-01-01',
    },
    status: 'authenticated' as const,
    update: vi.fn(),
  };
}

beforeEach(() => {
  // Default: no active lens. Individual tests opt in.
  mockUseLens.mockReturnValue({
    actualRole: null,
    lens: null,
    setLens: vi.fn(),
    familyId: null,
  });
});

describe('<PlatformAdminOnly>', () => {
  it('renders children for a platform admin with no lens active', () => {
    mockUseSession.mockReturnValue(makeSession(true));
    render(
      <PlatformAdminOnly>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(screen.getByText('Platform')).toBeDefined();
  });

  it('renders nothing for a non-platform-admin user', () => {
    mockUseSession.mockReturnValue(makeSession(false));
    const { container } = render(
      <PlatformAdminOnly>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders nothing when there is no session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    const { container } = render(
      <PlatformAdminOnly>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(container.textContent).toBe('');
  });

  it('hides the children when a platform admin has an admin lens active', () => {
    mockUseSession.mockReturnValue(makeSession(true));
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'admin',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { container } = render(
      <PlatformAdminOnly>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(container.textContent).toBe('');
  });

  it('hides the children when a platform admin has an editor lens active', () => {
    mockUseSession.mockReturnValue(makeSession(true));
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'editor',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { container } = render(
      <PlatformAdminOnly>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(container.textContent).toBe('');
  });

  it('hides the children when a platform admin has a viewer lens active', () => {
    mockUseSession.mockReturnValue(makeSession(true));
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    const { container } = render(
      <PlatformAdminOnly>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders the fallback when a platform admin has a lens active', () => {
    mockUseSession.mockReturnValue(makeSession(true));
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'f1',
    });
    render(
      <PlatformAdminOnly fallback={<span>placeholder</span>}>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(screen.getByText('placeholder')).toBeDefined();
    expect(screen.queryByText('Platform')).toBeNull();
  });

  it('renders the fallback for a non-platform-admin', () => {
    mockUseSession.mockReturnValue(makeSession(false));
    render(
      <PlatformAdminOnly fallback={<span>placeholder</span>}>
        <a href="/admin">Platform</a>
      </PlatformAdminOnly>,
    );
    expect(screen.getByText('placeholder')).toBeDefined();
  });
});
