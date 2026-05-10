'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  GitBranch,
  Microscope,
  Menu,
  FileStack,
  ArrowLeftRight,
  Activity,
  BarChart3,
  Settings,
  ExternalLink,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Permission } from '@ancstra/auth/types';
import { signOut } from 'next-auth/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { PlatformAdminOnly } from '@/components/auth/platform-admin-only';
import { LensSelector } from '@/components/sidebar/lens-selector';
import { LocaleSwitcher } from '@/components/sidebar/locale-switcher';
import { useVisibleNavItems } from '@/lib/nav/visible-items';
import { cn } from '@/lib/utils';

/**
 * Full bottom-tab-bar variant (NEXT_PUBLIC_SIDEBAR_VARIANT=tabbar-full).
 *
 * Replaces the hamburger drawer entirely on mobile. Five fixed tabs at the
 * bottom; "More" opens a bottom Sheet containing every secondary action
 * that no longer fits in the tab bar — Factsheets, Data, Activity, Data
 * Quality, plus the footer staples (Settings, Help, Sign Out, Lens, Locale).
 *
 * Lives behind a flag because it's a structural UX change worth A/B-ing
 * against the hybrid pattern before committing.
 */

type TabKey = 'dashboard' | 'people' | 'tree' | 'research';

interface TabItem {
  key: TabKey;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
}

const TABS: TabItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: Home },
  { key: 'people', href: '/persons', icon: Users },
  { key: 'tree', href: '/tree', icon: GitBranch, permission: 'tree:view' },
  { key: 'research', href: '/research', icon: Microscope, permission: 'ai:research' },
];

interface SecondaryItem {
  key:
    | 'factsheets'
    | 'importExport'
    | 'activity'
    | 'dataQuality'
    | 'settings'
    | 'help'
    | 'signOut'
    | 'platform';
  href?: string;
  icon: LucideIcon;
  permission?: Permission | Permission[];
  /** External (anchor with target=_blank) */
  external?: boolean;
  /** onClick handler instead of href */
  onClick?: () => void;
}

const SECONDARY: SecondaryItem[] = [
  { key: 'factsheets', href: '/research/factsheets', icon: FileStack, permission: 'ai:research' },
  {
    key: 'importExport',
    href: '/data',
    icon: ArrowLeftRight,
    permission: ['gedcom:import', 'gedcom:export'],
  },
  { key: 'activity', href: '/activity', icon: Activity, permission: 'activity:view' },
  { key: 'dataQuality', href: '/analytics/quality', icon: BarChart3, permission: 'activity:view' },
  { key: 'settings', href: '/settings', icon: Settings },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const tNav = useTranslations('navigation.items');
  const tDock = useTranslations('navigation.mobileDock');
  const visibleTabs = useVisibleNavItems(TABS);
  const visibleSecondary = useVisibleNavItems(SECONDARY);

  // External help link (kept off the SECONDARY list because it's an anchor,
  // not a next/link Link, and the URL is env-driven).
  const helpHref =
    process.env.NEXT_PUBLIC_DOCS_URL || 'https://ancstra-docs.vercel.app';

  return (
    <>
      <nav
        aria-label={tDock('ariaLabel')}
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t bg-sidebar text-sidebar-foreground pb-safe md:hidden"
      >
        {visibleTabs.map((tab) => {
          const hasMoreSpecificMatch = visibleTabs.some(
            (other) =>
              other.href !== tab.href &&
              other.href.startsWith(tab.href) &&
              pathname.startsWith(other.href),
          );
          const isActive =
            pathname.startsWith(tab.href) && !hasMoreSpecificMatch;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group/tab relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5',
                'text-muted-foreground transition-colors active:bg-sidebar-accent/40',
                isActive && 'text-primary',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary opacity-0 motion-safe:transition-opacity motion-safe:duration-200',
                  isActive && 'opacity-100',
                )}
              />
              <Icon className="size-5 shrink-0" />
              <span className="text-[10px] font-medium leading-none">
                {tNav(tab.key)}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            'group/more relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5',
            'text-muted-foreground transition-colors active:bg-sidebar-accent/40',
            moreOpen && 'text-primary',
          )}
        >
          <Menu className="size-5 shrink-0" />
          <span className="text-[10px] font-medium leading-none">
            {tDock('more')}
          </span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-safe data-closed:duration-150"
        >
          <SheetHeader>
            <SheetTitle>{tDock('more')}</SheetTitle>
            <SheetDescription className="sr-only">
              Secondary navigation and account actions.
            </SheetDescription>
          </SheetHeader>
          <SidebarMenu className="px-2 pb-2">
            <PlatformAdminOnly>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    href="/admin"
                    onClick={() => setMoreOpen(false)}
                  >
                    <ShieldCheck />
                    <span>{tNav('platform')}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </PlatformAdminOnly>
            {visibleSecondary.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.href ?? '#'}
                      onClick={() => setMoreOpen(false)}
                    >
                      <Icon />
                      <span>{tNav(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
            <LensSelector />
            <LocaleSwitcher />
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href={helpHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  <span>{tNav('help')}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setMoreOpen(false);
                  void signOut({ callbackUrl: '/login' });
                }}
              >
                <LogOut />
                <span>{tNav('signOut')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SheetContent>
      </Sheet>
    </>
  );
}
