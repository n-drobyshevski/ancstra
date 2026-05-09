// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { AppHeader } from '@/components/app-header';
import navigationMessages from '@/messages/en/navigation.json';
import commonMessages from '@/messages/en/common.json';
import React from 'react';

const messages = { navigation: navigationMessages, common: commonMessages };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// ── sidebar (throws without SidebarProvider) ──────────────────────────────────
vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <button data-testid="sidebar-trigger" />,
}));

// ── next-themes ───────────────────────────────────────────────────────────────
vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: vi.fn() }),
}));

// ── dropdown-menu: render inline (no Radix portal) so items appear in the DOM ──
// dropdownOpen is module-level state the mock components share between renders.
let dropdownOpen = false;

vi.mock('@/components/ui/dropdown-menu', () => {
  return {
    DropdownMenu: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),

    // Render as a plain button wrapping children; click toggles dropdownOpen.
    DropdownMenuTrigger: ({
      children,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) =>
      React.createElement(
        'button',
        {
          'data-testid': 'dropdown-trigger',
          onClick: () => {
            dropdownOpen = !dropdownOpen;
          },
        },
        children,
      ),

    // Render content inline when open; null when closed.
    DropdownMenuContent: ({
      children,
    }: {
      children: React.ReactNode;
      align?: string;
    }) =>
      dropdownOpen
        ? React.createElement(
            'div',
            { 'data-testid': 'dropdown-content' },
            children,
          )
        : null,

    DropdownMenuItem: ({
      children,
      onClick,
      className,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      className?: string;
    }) =>
      React.createElement(
        'div',
        { role: 'menuitem', onClick, className },
        children,
      ),
  };
});

// ── next-auth ─────────────────────────────────────────────────────────────────
const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

// ── next/navigation ───────────────────────────────────────────────────────────
const mockRouterPush = vi.fn();
const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
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
type FamilyRole = 'owner' | 'admin' | 'editor' | 'viewer';

function makeFamily(id: string, name: string, role: FamilyRole) {
  return { id, name, role };
}

function makeSession(familyId: string) {
  return {
    data: {
      user: {
        id: 'u1',
        memberships: [{ familyId, role: 'owner', dbFilename: `${familyId}.db` }],
        membershipsVersion: 0,
      },
      expires: '2099-01-01',
    },
    status: 'authenticated' as const,
    update: vi.fn(),
  };
}

/** Find the FamilyPicker trigger button (the one that contains the family name text). */
function getFamilyPickerTrigger(familyName: string) {
  // The trigger button contains the family name span
  return screen.getByText(familyName).closest('[data-testid="dropdown-trigger"]') as HTMLElement;
}

describe('FamilyPicker mounted in AppHeader', () => {
  beforeEach(() => {
    dropdownOpen = false;
    mockRouterPush.mockReset();
    mockSearchParams.mockReturnValue(new URLSearchParams());
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    });
  });

  it('renders nothing from FamilyPicker when user has only 1 membership', () => {
    mockListMineUseQuery.mockReturnValue({
      data: [makeFamily('f1', 'Smith Family', 'owner')],
      isLoading: false,
    });
    mockUseSession.mockReturnValue(makeSession('f1'));

    renderWithIntl(<AppHeader />);

    // The picker renders null when families.length <= 1, so no family name in DOM
    expect(screen.queryByText('Smith Family')).toBeNull();
  });

  it('renders picker trigger with 2+ memberships and dropdown lists both with role badges', () => {
    const families = [
      makeFamily('f1', 'Smith Family', 'owner'),
      makeFamily('f2', 'Jones Family', 'editor'),
    ];
    mockListMineUseQuery.mockReturnValue({ data: families, isLoading: false });
    mockUseSession.mockReturnValue(makeSession('f1'));

    const { rerender } = renderWithIntl(<AppHeader />);

    // Trigger button should show the active family name
    expect(screen.getByText('Smith Family')).toBeDefined();

    // Open the dropdown by clicking the FamilyPicker trigger
    const trigger = getFamilyPickerTrigger('Smith Family');
    fireEvent.click(trigger);
    // Rerender so DropdownMenuContent sees the updated dropdownOpen state
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AppHeader />
      </NextIntlClientProvider>,
    );

    // Both family names should be in the open menu
    expect(screen.getAllByText('Smith Family').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Jones Family')).toBeDefined();

    // Role badges render the translated role label.
    expect(screen.getByText('Owner')).toBeDefined();
    expect(screen.getByText('Editor')).toBeDefined();
  });

  it('clicking a non-active family calls router.push with ?family=<id>', () => {
    const families = [
      makeFamily('f1', 'Smith Family', 'owner'),
      makeFamily('f2', 'Jones Family', 'editor'),
    ];
    mockListMineUseQuery.mockReturnValue({ data: families, isLoading: false });
    mockUseSession.mockReturnValue(makeSession('f1'));

    const { rerender } = renderWithIntl(<AppHeader />);

    // Open the dropdown
    const trigger = getFamilyPickerTrigger('Smith Family');
    fireEvent.click(trigger);
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AppHeader />
      </NextIntlClientProvider>,
    );

    // Click the second family item
    const jonesItem = screen.getByText('Jones Family');
    fireEvent.click(jonesItem);

    expect(mockRouterPush).toHaveBeenCalledWith('?family=f2');
  });
});
