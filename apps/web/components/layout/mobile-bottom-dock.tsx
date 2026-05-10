'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  GitBranch,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Permission } from '@ancstra/auth/types';
import { useSidebar } from '@/components/ui/sidebar';
import { useVisibleNavItems } from '@/lib/nav/visible-items';
import { cn } from '@/lib/utils';

/**
 * Fixed bottom dock — primary mobile navigation. Rendered unconditionally
 * and hidden on desktop via `md:hidden` so SSR HTML matches the first
 * client render (no `isMobile` flicker pre-hydration).
 *
 * Three direct routes (Dashboard / People / Tree) plus a "More" tab that
 * opens the existing sidebar drawer for everything else. Each tap target
 * is at least 44 × 44 to meet the touch-target rule; the container reserves
 * its own safe-area bottom inset via `pb-safe` so the drawer of fixed UI
 * always clears the home indicator.
 */

type DockNavKey = 'dashboard' | 'people' | 'tree';

interface DockNavItem {
  key: DockNavKey;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
}

const NAV_ITEMS: DockNavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: Home },
  { key: 'people', href: '/persons', icon: Users },
  { key: 'tree', href: '/tree', icon: GitBranch, permission: 'tree:view' },
];

export function MobileBottomDock() {
  const pathname = usePathname();
  const { setOpenMobile, openMobile } = useSidebar();
  const tNav = useTranslations('navigation.items');
  const tDock = useTranslations('navigation.mobileDock');
  const visible = useVisibleNavItems(NAV_ITEMS);

  return (
    <nav
      aria-label={tDock('ariaLabel')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t bg-sidebar text-sidebar-foreground pb-safe md:hidden',
      )}
    >
      {visible.map((item) => {
        // Longest-match active state, mirroring NavGroup's logic. With only
        // three flat routes (no nesting) this is essentially a startsWith,
        // but we keep the shape so adding nested items later behaves.
        const hasMoreSpecificMatch = visible.some(
          (other) =>
            other.href !== item.href &&
            other.href.startsWith(item.href) &&
            pathname.startsWith(other.href),
        );
        const isActive =
          pathname.startsWith(item.href) && !hasMoreSpecificMatch;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group/dock-item relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5',
              'text-muted-foreground transition-colors',
              'active:bg-sidebar-accent/40',
              isActive && 'text-primary',
            )}
          >
            {/* Active indicator pill — fades in only on the active tab. */}
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary opacity-0 motion-safe:transition-opacity motion-safe:duration-200',
                isActive && 'opacity-100',
              )}
            />
            <Icon className="size-5 shrink-0" />
            <span className="text-[10px] font-medium leading-none">
              {tNav(item.key)}
            </span>
          </Link>
        );
      })}
      {/* "More" — opens the existing sidebar drawer for secondary actions. */}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        aria-haspopup="dialog"
        aria-expanded={openMobile}
        className={cn(
          'group/dock-more relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5',
          'text-muted-foreground transition-colors',
          'active:bg-sidebar-accent/40',
          openMobile && 'text-primary',
        )}
      >
        <Menu className="size-5 shrink-0" />
        <span className="text-[10px] font-medium leading-none">
          {tDock('more')}
        </span>
      </button>
    </nav>
  );
}
