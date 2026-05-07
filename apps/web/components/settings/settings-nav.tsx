'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Palette, Shield, Database, Bot, Home, Users, Activity, type LucideIcon } from 'lucide-react';
import type { Permission } from '@ancstra/auth/types';
import { useActiveMembership } from '@/lib/auth/use-has-permission';
import { hasPermission } from '@ancstra/auth/permissions';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  /** Optional: only show if the active membership has this permission. */
  permission?: Permission;
}

export const navItems: NavItem[] = [
  { title: 'Family', subtitle: 'Name, limits, moderation', href: '/settings/family', icon: Home, permission: 'members:manage' },
  { title: 'Members', subtitle: 'Invites and roles', href: '/settings/members', icon: Users, permission: 'members:manage' },
  { title: 'Activity', subtitle: 'Recent changes', href: '/activity', icon: Activity, permission: 'activity:view' },
  { title: 'Search Sources', subtitle: 'Genealogy databases & providers', href: '/settings/sources', icon: Search },
  { title: 'Appearance', subtitle: 'Theme and display', href: '/settings/appearance', icon: Palette },
  { title: 'Privacy', subtitle: 'Living persons & data handling', href: '/settings/privacy', icon: Shield },
  { title: 'Data & Storage', subtitle: 'Backups, cache, archives', href: '/settings/data', icon: Database },
  { title: 'AI', subtitle: 'Usage and budget', href: '/settings/ai', icon: Bot },
];

/**
 * Visible nav items for the active membership. Items with no `permission`
 * are universally visible; items with one are gated by the role's perms.
 * Server-side gating still applies — this is affordance hiding only.
 */
export function useVisibleSettingsNavItems(): NavItem[] {
  const membership = useActiveMembership();
  return navItems.filter((item) => {
    if (!item.permission) return true;
    if (!membership) return false;
    return hasPermission(membership.role, item.permission);
  });
}

export function SettingsNav() {
  const pathname = usePathname();
  const visible = useVisibleSettingsNavItems();

  return (
    <nav className="hidden md:block w-[200px] shrink-0 border-r border-border pr-4 space-y-1">
      {visible.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
