import {
  Search,
  Palette,
  Shield,
  Database,
  Bot,
  Home,
  Users,
  Activity,
  User,
  Sliders,
  type LucideIcon,
} from 'lucide-react';
import type { Permission, Role } from '@ancstra/auth/types';
import { hasPermission } from '@ancstra/auth/permissions';

export type SectionTier = 'profile' | 'editor' | 'admin' | 'owner';

export interface NavItem {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  /**
   * Required permission to see this item. Items with no permission are
   * universally visible (per-user prefs). Server still enforces; this is
   * affordance hiding only.
   */
  permission?: Permission;
}

export interface NavSection {
  tier: SectionTier;
  title: string;
  items: NavItem[];
}

/**
 * Source-of-truth section layout. Tier semantics: each section names the
 * LOWEST role that sees any of its items. Items inside a section may have
 * different permissions (e.g. Activity is `activity:view` which editors also
 * have) but the section header reflects what visiting that section means
 * organisationally — admins manage members, owners configure ownership.
 *
 * Phase 2 layout:
 * - profile: universal (no permission)
 * - editor:  Data & Storage (editor+ via gedcom:export); P3 adds Editor defaults
 * - admin:   Family / Members / Activity (members:manage; Activity is more
 *            permissive but lives here for organisational coherence)
 * - owner:   Search Sources / Privacy / AI (settings:manage)
 */
const SECTIONS: NavSection[] = [
  {
    tier: 'profile',
    title: 'My profile',
    items: [
      {
        title: 'Profile',
        subtitle: 'Display name, language, notifications',
        href: '/settings/profile',
        icon: User,
      },
      {
        title: 'Appearance',
        subtitle: 'Theme and display',
        href: '/settings/appearance',
        icon: Palette,
      },
      {
        title: 'Activity',
        subtitle: 'Recent changes in your family',
        href: '/activity',
        icon: Activity,
        // activity:view is granted to every role, so this surfaces for all
        // users — placed in the personal section rather than admin tools.
        permission: 'activity:view',
      },
    ],
  },
  {
    tier: 'editor',
    title: 'Editor defaults',
    items: [
      {
        title: 'Editor defaults',
        subtitle: 'Privacy, export, citation defaults',
        href: '/settings/editor-defaults',
        icon: Sliders,
        permission: 'person:create',
      },
      {
        title: 'Data & Storage',
        subtitle: 'Backups, cache, archives',
        href: '/settings/data',
        icon: Database,
        permission: 'gedcom:export',
      },
    ],
  },
  {
    tier: 'admin',
    title: 'Admin tools',
    items: [
      {
        title: 'Family',
        subtitle: 'Name, limits, moderation',
        href: '/settings/family',
        icon: Home,
        permission: 'members:manage',
      },
      {
        title: 'Members',
        subtitle: 'Invites and roles',
        href: '/settings/members',
        icon: Users,
        permission: 'members:manage',
      },
      {
        title: 'Search Sources',
        subtitle: 'Genealogy databases & providers',
        href: '/settings/sources',
        icon: Search,
        permission: 'members:manage',
      },
    ],
  },
  {
    tier: 'owner',
    title: 'Ownership',
    items: [
      {
        title: 'Privacy',
        subtitle: 'Living persons & data handling',
        href: '/settings/privacy',
        icon: Shield,
        permission: 'settings:manage',
      },
      {
        title: 'AI',
        subtitle: 'Usage and budget',
        href: '/settings/ai',
        icon: Bot,
        permission: 'settings:manage',
      },
    ],
  },
];

function isVisibleItem(item: NavItem, role: Role | null, isHydrated: boolean): boolean {
  if (!item.permission) return true;
  if (!isHydrated) return false;
  if (!role) return false;
  return hasPermission(role, item.permission);
}

/**
 * Returns the sections (with their items already filtered) that the given
 * role can see. Empty sections are dropped so we never render a stranded
 * heading. Pre-hydration (`isHydrated=false`) we treat the role as unknown
 * to keep server HTML and first client render in sync with `useSession`'s
 * loading state.
 */
export function getVisibleSettingsSections(
  role: Role | null,
  isHydrated: boolean,
): NavSection[] {
  return SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((i) => isVisibleItem(i, role, isHydrated)),
    }))
    .filter((section) => section.items.length > 0);
}
