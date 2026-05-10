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
 */

import { MobileBottomDock } from './mobile-bottom-dock';
import { MobileTabBar } from './mobile-tab-bar';

type Variant = 'hybrid' | 'tabbar-full';

const RAW = process.env.NEXT_PUBLIC_SIDEBAR_VARIANT;
export const SIDEBAR_VARIANT: Variant =
  RAW === 'tabbar-full' ? 'tabbar-full' : 'hybrid';

export function MobileNav() {
  if (SIDEBAR_VARIANT === 'tabbar-full') {
    return <MobileTabBar />;
  }
  return <MobileBottomDock />;
}
