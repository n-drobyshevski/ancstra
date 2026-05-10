// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import React from 'react';
import navigationMessages from '@/messages/en/navigation.json';
import { installMatchMediaMock } from '../helpers/match-media-mock';

// ── next/navigation: pathname is module-level so individual tests can swap ──
let currentPathname = '/dashboard';
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

// ── permission gating: pass everything through unfiltered so we test the dock
//    logic, not the permission filter (covered separately).
vi.mock('@/lib/nav/visible-items', () => ({
  useVisibleNavItems: <T,>(items: T[]) => items,
}));

// ── useSidebar context: stub openMobile + capture setOpenMobile calls ──
const setOpenMobile = vi.fn();
let openMobile = false;
vi.mock('@/components/ui/sidebar', async () => {
  const actual = await vi.importActual<typeof import('@/components/ui/sidebar')>(
    '@/components/ui/sidebar',
  );
  return {
    ...actual,
    useSidebar: () => ({
      state: 'expanded',
      open: false,
      setOpen: vi.fn(),
      openMobile,
      setOpenMobile,
      isMobile: true,
      toggleSidebar: vi.fn(),
    }),
  };
});

// Import AFTER mocks so the dock picks up the mocked modules.
import { MobileBottomDock } from '@/components/layout/mobile-bottom-dock';

const messages = { navigation: navigationMessages };

function renderDock() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MobileBottomDock />
    </NextIntlClientProvider>,
  );
}

describe('MobileBottomDock', () => {
  beforeEach(() => {
    installMatchMediaMock(390); // iPhone 14 portrait
    currentPathname = '/dashboard';
    openMobile = false;
    setOpenMobile.mockReset();
  });

  it('renders three direct routes plus a More tab', () => {
    renderDock();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /people/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /tree/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /more/i })).toBeDefined();
  });

  it('marks the active route with aria-current="page"', () => {
    currentPathname = '/persons';
    renderDock();
    const peopleLink = screen.getByRole('link', { name: /people/i });
    expect(peopleLink.getAttribute('aria-current')).toBe('page');
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink.getAttribute('aria-current')).toBeNull();
  });

  it('marks nested routes active via prefix match', () => {
    currentPathname = '/persons/abc123/timeline';
    renderDock();
    expect(
      screen.getByRole('link', { name: /people/i }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('opens the sidebar drawer when "More" is tapped', () => {
    renderDock();
    const moreButton = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreButton);
    expect(setOpenMobile).toHaveBeenCalledWith(true);
  });

  it('exposes the aria-expanded state of the drawer on the More button', () => {
    openMobile = true;
    renderDock();
    const moreButton = screen.getByRole('button', { name: /more/i });
    expect(moreButton.getAttribute('aria-expanded')).toBe('true');
    expect(moreButton.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('keeps the nav element hidden on md+ via the md:hidden class', () => {
    renderDock();
    const nav = screen.getByRole('navigation');
    expect(nav.className).toMatch(/\bmd:hidden\b/);
  });

  it('uses a semantic <nav> with an aria-label landmark', () => {
    renderDock();
    const nav = screen.getByRole('navigation');
    expect(nav.getAttribute('aria-label')).toBe(
      navigationMessages.mobileDock.ariaLabel,
    );
  });
});
