// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InviteDialog } from '@/components/members/invite-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Radix Select uses these DOM APIs not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

function openDialogAndRoleSelect() {
  fireEvent.click(screen.getByRole('button', { name: /invite member/i }));
  // Open the Radix Select via pointerDown on the trigger
  const trigger = screen.getByLabelText('Role');
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe('<InviteDialog> role gating', () => {
  it('owner inviter sees admin role option', () => {
    render(<InviteDialog familyId="fam-1" currentRole="owner" />);
    openDialogAndRoleSelect();
    // queryByRole excludes aria-hidden elements (e.g. Radix's hidden native <select>)
    expect(screen.queryByRole('option', { name: 'Admin' })).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'Editor' })).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'Viewer' })).not.toBeNull();
  });

  it('admin inviter does NOT see admin role option', () => {
    render(<InviteDialog familyId="fam-1" currentRole="admin" />);
    openDialogAndRoleSelect();
    expect(screen.queryByRole('option', { name: 'Admin' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Editor' })).not.toBeNull();
    expect(screen.queryByRole('option', { name: 'Viewer' })).not.toBeNull();
  });
});
