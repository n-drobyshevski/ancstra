'use client';

/**
 * Mobile navigation orchestrator. Picks the bottom-bar pattern based on the
 * `NEXT_PUBLIC_SIDEBAR_VARIANT` env var (read at module top-level so Next
 * inlines the value at build time — no runtime branch).
 *
 *   hybrid       (default) Bottom dock with 3 primary routes + a "More" tab
 *                          that opens the existing hamburger drawer.
 *   tabbar-full            5-tab bottom bar — Dashboard / People / Tree /
 *                          Research / More. Drawer is suppressed on mobile;
 *                          "More" opens a bottom sheet with the rest.
 *
 * The variant gate also affects:
 *   - `app-sidebar.tsx` — drawer Sidebar is CSS-hidden under tabbar-full at
 *     mobile sizes.
 *   - `app-header.tsx` — hamburger SidebarTrigger is CSS-hidden under
 *     tabbar-full at mobile sizes.
 *
 * Both gates are pure-CSS (data-attribute + max-md:hidden) to avoid the
 * hydration mismatch that would result from a runtime `isMobile` branch.
 *
 * Hiding on focused-task routes: routes that render their own primary
 * `fixed bottom-0 z-50 md:hidden` action bar (e.g. the PersonForm "Save"
 * footer) own the bottom slot — keeping the global dock rendered behind
 * them at z-40 just creates dead pixels under the form button. We hide the
 * dock on those routes via `hidesMobileNav` below.
 */

import { usePathname } from 'next/navigation';
import { MobileBottomDock } from './mobile-bottom-dock';
import { MobileTabBar } from './mobile-tab-bar';

type Variant = 'hybrid' | 'tabbar-full';

const RAW = process.env.NEXT_PUBLIC_SIDEBAR_VARIANT;
export const SIDEBAR_VARIANT: Variant =
  RAW === 'tabbar-full' ? 'tabbar-full' : 'hybrid';

/**
 * Routes that own the mobile bottom slot via their own primary action bar.
 * Keep in sync with components that render `fixed inset-x-0 bottom-0 z-50
 * md:hidden` (currently: `person-form.tsx`). New focused-task forms should
 * add their route patterns here.
 */
export function hidesMobileNav(pathname: string): boolean {
  // Mirror `contextual-fab.tsx`'s locale stripping — keep in sync with
  // `apps/web/i18n/routing.ts#locales`.
  const path = pathname.replace(/^\/(en|ru)(?=\/|$)/, '') || '/';
  return (
    path === '/persons/new' || /^\/persons\/[^/]+\/edit$/.test(path)
  );
}

export function MobileNav() {
  const pathname = usePathname();
  if (hidesMobileNav(pathname)) return null;
  if (SIDEBAR_VARIANT === 'tabbar-full') {
    return <MobileTabBar />;
  }
  return <MobileBottomDock />;
}
