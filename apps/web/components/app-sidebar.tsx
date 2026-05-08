'use client';

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
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@ancstra/auth/types';
import { hasPermission } from '@ancstra/auth/permissions';
import { PlatformAdminOnly } from '@/components/auth/platform-admin-only';
import { LensSelector } from '@/components/sidebar/lens-selector';
import { useEffectiveMembership } from '@/lib/auth/use-has-permission';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
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
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
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
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'People', href: '/persons', icon: Users },
  { title: 'Tree', href: '/tree', icon: GitBranch, permission: 'tree:view' },
];

const researchItems: NavItem[] = [
  { title: 'Research', href: '/research', icon: Microscope, permission: 'ai:research' },
  {
    title: 'Factsheets',
    href: '/research/factsheets',
    icon: FileStack,
    permission: 'ai:research',
  },
];

const dataItems: NavItem[] = [
  {
    title: 'Import / Export',
    href: '/data',
    icon: ArrowLeftRight,
    // Visible if the user can do EITHER side — page itself routes to the
    // correct tab based on which permission they hold.
    permission: ['gedcom:import', 'gedcom:export'],
  },
  { title: 'Activity', href: '/activity', icon: Activity, permission: 'activity:view' },
];

const analyticsItems: NavItem[] = [
  {
    title: 'Data Quality',
    href: '/analytics/quality',
    icon: BarChart3,
    permission: 'activity:view',
  },
];

/**
 * Filter nav items by the user's effective (lens-aware) permissions.
 * Same semantics as `useVisibleSettingsNavItems` in components/settings/settings-nav.tsx.
 *
 * Gated by `useIsHydrated` because `useEffectiveMembership` ultimately reads
 * `useSession()`, which returns different data on the SSR pass vs. the first
 * client render once the SessionProvider hydrates. Until hydration completes
 * we render only items that are universally visible — server HTML and first
 * client render then match, and permissioned items pop in post-hydration.
 */
function useVisibleNavItems(items: NavItem[]): NavItem[] {
  const isHydrated = useIsHydrated();
  const membership = useEffectiveMembership();
  return items.filter((item) => {
    if (!item.permission) return true;
    if (!isHydrated) return false;
    if (!membership) return false;
    const required = Array.isArray(item.permission) ? item.permission : [item.permission];
    return required.some((p) => hasPermission(membership.role, p));
  });
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  const { setOpenMobile } = useSidebar();
  const visible = useVisibleNavItems(items);

  // Collapse the entire group when nothing is visible. Avoids a stranded
  // section header (e.g. "Research") when a viewer lens hides every child.
  if (visible.length === 0) return null;

  return (
    <SidebarGroup>
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

          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
              >
                <Link href={item.href} onClick={() => setOpenMobile(false)}>
                  <item.icon />
                  <span>{item.title}</span>
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
  const { setOpenMobile } = useSidebar();

  // Inject live badge counts into nav items
  const researchWithBadges = researchItems.map((item) => {
    if (item.href === '/research/factsheets') return { ...item, badge: factsheetCount };
    return item;
  });

  return (
    <Sidebar collapsible="icon" role="navigation" aria-label="Main navigation">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={() => setOpenMobile(false)}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-sm font-bold">A</span>
                </div>
                <span className="font-semibold">Ancstra</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup items={coreItems} pathname={pathname} />
        <NavGroup label="Research" items={researchWithBadges} pathname={pathname} />
        <NavGroup label="Data" items={dataItems} pathname={pathname} />
        <NavGroup label="Analytics" items={analyticsItems} pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <PlatformAdminOnly>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Platform Admin">
                <Link href="/admin" onClick={() => setOpenMobile(false)}>
                  <ShieldCheck />
                  <span>Platform</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </PlatformAdminOnly>
          <LensSelector />
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings" onClick={() => setOpenMobile(false)}>
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Help">
              <a
                href={process.env.NEXT_PUBLIC_DOCS_URL || 'https://ancstra-docs.vercel.app'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                <span>Help</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign Out"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <LogOut />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
