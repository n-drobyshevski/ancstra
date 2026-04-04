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
  type LucideIcon,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useFactsheetCount } from '@/lib/research/factsheet-client';
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
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

const coreItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'People', href: '/persons', icon: Users },
  { title: 'Tree', href: '/tree', icon: GitBranch },
];

const researchItems: NavItem[] = [
  { title: 'Research', href: '/research', icon: Microscope },
  { title: 'Factsheets', href: '/research/factsheets', icon: FileStack },
];

const dataItems: NavItem[] = [
  { title: 'Import / Export', href: '/data', icon: ArrowLeftRight },
  { title: 'Activity', href: '/activity', icon: Activity },
];

const analyticsItems: NavItem[] = [
  { title: 'Data Quality', href: '/analytics/quality', icon: BarChart3 },
];

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          const hasMoreSpecificMatch = items.some(
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
                <Link href={item.href}>
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

export function AppSidebar() {
  const pathname = usePathname();
  const { count: factsheetCount } = useFactsheetCount();

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
              <Link href="/dashboard">
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
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
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
