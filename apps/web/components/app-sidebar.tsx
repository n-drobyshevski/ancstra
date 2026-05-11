'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Users,
  GitBranch,
  Microscope,
  ArrowLeftRight,
  Activity,
  BarChart3,
  Settings,
  LogOut,
  ExternalLink,
  FileStack,
  Workflow,
  ShieldCheck,
  ChevronDown,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Permission } from '@ancstra/auth/types';
import { PlatformAdminOnly } from '@/components/auth/platform-admin-only';
import { LensSelector } from '@/components/sidebar/lens-selector';
import { LocaleSwitcher } from '@/components/sidebar/locale-switcher';
import { useVisibleNavItems } from '@/lib/nav/visible-items';
import { signOut } from 'next-auth/react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type NavItemKey =
  | 'dashboard'
  | 'people'
  | 'tree'
  | 'research'
  | 'factsheets'
  | 'threads'
  | 'importExport'
  | 'activity'
  | 'dataQuality';

interface NavItem {
  /** Translation key under `navigation.items.*` */
  key: NavItemKey;
  href: string;
  icon: LucideIcon;
  badge?: number;
  /**
   * Required permission to see this item. Single = AND. Array = OR (item is
   * visible if the user holds at least one of the listed permissions). Items
   * with no permission are universally visible.
   *
   * Server-side enforcement (tRPC `protectedProcedure`, RSC `requirePagePermission`)
   * is the source of truth; this filter is affordance hiding only.
   */
  permission?: Permission | Permission[];
}

const coreItems: NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: Home },
  { key: 'people', href: '/persons', icon: Users },
  { key: 'tree', href: '/tree', icon: GitBranch, permission: 'tree:view' },
];

const researchItems: NavItem[] = [
  { key: 'research', href: '/research', icon: Microscope, permission: 'ai:research' },
  {
    key: 'factsheets',
    href: '/research/factsheets',
    icon: FileStack,
    permission: 'ai:research',
  },
  {
    key: 'threads',
    href: '/research/threads',
    icon: Workflow,
    permission: 'ai:research',
  },
];

const dataItems: NavItem[] = [
  {
    key: 'importExport',
    href: '/data',
    icon: ArrowLeftRight,
    // Visible if the user can do EITHER side — page itself routes to the
    // correct tab based on which permission they hold.
    permission: ['gedcom:import', 'gedcom:export'],
  },
  { key: 'activity', href: '/activity', icon: Activity, permission: 'activity:view' },
];

const analyticsItems: NavItem[] = [
  {
    key: 'dataQuality',
    href: '/analytics/quality',
    icon: BarChart3,
    permission: 'activity:view',
  },
];

function NavGroup({
  label,
  items,
  pathname,
  className,
  style,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { setOpenMobile } = useSidebar();
  const t = useTranslations('navigation.items');
  const visible = useVisibleNavItems(items);

  // Collapse the entire group when nothing is visible. Avoids a stranded
  // section header (e.g. "Research") when a viewer lens hides every child.
  if (visible.length === 0) return null;

  return (
    <SidebarGroup className={className} style={style}>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {visible.map((item) => {
          const hasMoreSpecificMatch = visible.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(item.href) &&
              pathname.startsWith(other.href)
          );
          const isActive = pathname.startsWith(item.href) && !hasMoreSpecificMatch;
          const title = t(item.key);

          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={title}
              >
                <Link href={item.href} onClick={() => setOpenMobile(false)}>
                  <item.icon />
                  <span>{title}</span>
                </Link>
              </SidebarMenuButton>
              {item.badge != null && item.badge > 0 && (
                <SidebarMenuBadge className="bg-primary/20 text-primary">
                  {item.badge}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

interface AppSidebarProps {
  factsheetCount?: number;
}

export function AppSidebar({ factsheetCount = 0 }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile, openMobile, isMobile } = useSidebar();
  const tNav = useTranslations('navigation');
  const tGroups = useTranslations('navigation.groups');
  const tItems = useTranslations('navigation.items');
  const tTooltips = useTranslations('navigation.tooltips');

  // Inject live badge counts into nav items
  const researchWithBadges = researchItems.map((item) => {
    if (item.href === '/research/factsheets') return { ...item, badge: factsheetCount };
    return item;
  });

  // Stagger nav group entrance only when the mobile drawer opens — desktop
  // users would otherwise see this animation on every navigation. Each
  // group is offset 30 ms; total 120 ms across four groups. `fill-mode-both`
  // keeps the initial (invisible) frame applied during the delay so groups
  // don't flash visible before their turn.
  const staggerClass =
    openMobile && isMobile
      ? 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-200 motion-safe:fill-mode-both'
      : undefined;
  const staggerStyle = (i: number): CSSProperties | undefined =>
    openMobile && isMobile ? { animationDelay: `${i * 30}ms` } : undefined;

  return (
    <Sidebar collapsible="icon" role="navigation" aria-label={tNav('ariaLabel')}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">A</span>
                </div>
                <span className="font-semibold">{tNav('brand')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup
          items={coreItems}
          pathname={pathname}
          className={staggerClass}
          style={staggerStyle(0)}
        />
        <NavGroup
          label={tGroups('research')}
          items={researchWithBadges}
          pathname={pathname}
          className={staggerClass}
          style={staggerStyle(1)}
        />
        <NavGroup
          label={tGroups('data')}
          items={dataItems}
          pathname={pathname}
          className={staggerClass}
          style={staggerStyle(2)}
        />
        <NavGroup
          label={tGroups('analytics')}
          items={analyticsItems}
          pathname={pathname}
          className={staggerClass}
          style={staggerStyle(3)}
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {/* Inline footer: highest-frequency secondary actions stay visible. */}
          <LensSelector />
          <LocaleSwitcher />
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={tTooltips('settings')}>
              <Link href="/settings" onClick={() => setOpenMobile(false)}>
                <Settings />
                <span>{tItems('settings')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* "More" collapsible — collapses Admin / Help / Sign Out so the
              mobile sheet footer stays scannable. Hidden contents are
              still keyboard-reachable via the Collapsible primitive. */}
          <Collapsible asChild className="group/footer-more">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  tooltip={tTooltips('more')}
                  aria-controls="sidebar-footer-more"
                >
                  <MoreHorizontal />
                  <span>{tItems('more')}</span>
                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/footer-more:rotate-180" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent id="sidebar-footer-more">
                <SidebarMenuSub>
                  <PlatformAdminOnly>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild>
                        <Link href="/admin" onClick={() => setOpenMobile(false)}>
                          <ShieldCheck />
                          <span>{tItems('platform')}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </PlatformAdminOnly>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <a
                        href={
                          process.env.NEXT_PUBLIC_DOCS_URL ||
                          'https://ancstra-docs.vercel.app'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink />
                        <span>{tItems('help')}</span>
                      </a>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="w-full cursor-pointer text-left"
                      >
                        <LogOut />
                        <span>{tItems('signOut')}</span>
                      </button>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
