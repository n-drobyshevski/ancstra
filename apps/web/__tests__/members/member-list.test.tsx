// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { MemberList } from '@/components/members/member-list';
import commonMessages from '@/messages/en/common.json';
import React from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const messages = { common: commonMessages };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const mockMembers = [
  {
    id: 'm-1', userId: 'u-owner', role: 'owner', joinedAt: '2026-01-01',
    lastSeenAt: '2026-05-07T10:00:00Z', name: 'Alice', email: 'o@t',
  },
  {
    id: 'm-2', userId: 'u-admin', role: 'admin', joinedAt: '2026-02-01',
    lastSeenAt: null, name: 'Bob', email: 'a@t',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(mockMembers), { status: 200 })
  );
});

/** Open a Radix DropdownMenuTrigger in jsdom (requires pointer events). */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.click(trigger);
}

describe('<MemberList>', () => {
  it('renders Last seen column header', async () => {
    renderWithIntl(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-owner" currentRole="owner" />);
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0));
    // Header only appears in desktop Table (mobile cards have no column headers)
    expect(screen.getByText('Last seen')).not.toBeNull();
  });

  it('renders em-dash for null lastSeenAt', async () => {
    renderWithIntl(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-owner" currentRole="owner" />);
    await waitFor(() => expect(screen.getAllByText('Bob').length).toBeGreaterThan(0));
    // Both desktop row and mobile card render '—' when lastSeenAt is null
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('owner sees Transfer ownership in dropdown for admin row', async () => {
    renderWithIntl(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-owner" currentRole="owner" />);
    await waitFor(() => expect(screen.getAllByText('Bob').length).toBeGreaterThan(0));

    // Both surfaces render an actions trigger; opening either reveals the same menu
    const triggers = screen.getAllByLabelText('Member actions');
    openDropdown(triggers[0]);

    await waitFor(() => {
      expect(screen.getByText(/transfer ownership/i)).not.toBeNull();
      expect(screen.getByText(/remove member/i)).not.toBeNull();
    });
  });

  it('admin caller does not see Transfer ownership', async () => {
    renderWithIntl(<MemberList familyId="fam-1" familyName="Test" currentUserId="u-admin" currentRole="admin" />);
    await waitFor(() => expect(screen.getAllByText('Bob').length).toBeGreaterThan(0));

    const triggers = screen.queryAllByLabelText('Member actions');
    for (const t of triggers) openDropdown(t);
    expect(screen.queryByText(/transfer ownership/i)).toBeNull();
  });
});
