// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGate } from '@/components/auth/role-gate';

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

function makeSession(role: 'owner' | 'admin' | 'editor' | 'viewer') {
  return {
    data: {
      user: {
        id: 'u1',
        memberships: [{ familyId: 'f1', role, dbFilename: 'f1.db' }],
        membershipsVersion: 0,
      },
      expires: '2099-01-01',
    },
    status: 'authenticated' as const,
    update: vi.fn(),
  };
}

describe('<RoleGate>', () => {
  beforeEach(() => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('renders children when role has permission', () => {
    mockUseSession.mockReturnValue(makeSession('admin'));
    render(
      <RoleGate permission="person:edit">
        <button>Edit</button>
      </RoleGate>,
    );
    expect(screen.getByText('Edit')).toBeDefined();
  });

  it('renders nothing (null) when role lacks permission and no fallback', () => {
    mockUseSession.mockReturnValue(makeSession('viewer'));
    const { container } = render(
      <RoleGate permission="person:edit">
        <button>Edit</button>
      </RoleGate>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders fallback when role lacks permission and fallback is provided', () => {
    mockUseSession.mockReturnValue(makeSession('viewer'));
    render(
      <RoleGate
        permission="person:edit"
        fallback={<span>read-only</span>}
      >
        <button>Edit</button>
      </RoleGate>,
    );
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.getByText('read-only')).toBeDefined();
  });

  it('renders fallback (null default) when no session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    const { container } = render(
      <RoleGate permission="tree:view">
        <span>tree</span>
      </RoleGate>,
    );
    expect(container.textContent).toBe('');
  });

  it('viewer can view tree:view (positive case)', () => {
    mockUseSession.mockReturnValue(makeSession('viewer'));
    render(
      <RoleGate permission="tree:view">
        <span>tree</span>
      </RoleGate>,
    );
    expect(screen.getByText('tree')).toBeDefined();
  });
});
