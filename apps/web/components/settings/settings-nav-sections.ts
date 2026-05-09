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

/**
 * Translation keys under `settings.nav.items` and `settings.nav.subtitles`.
 * The render layer resolves these to localized strings; the model just holds
 * structural identifiers + permissions + icons.
 */
export type NavItemKey =
  | 'profile'
  | 'appearance'
  | 'activity'
  | 'family'
  | 'members'
  | 'dataStorage'
  | 'editorDefaults'
  | 'searchSources'
  | 'privacy'
  | 'ai';

export interface NavItem {
  key: NavItemKey;
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
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    tier: 'profile',
    items: [
      { key: 'profile', href: '/settings/profile', icon: User },
      { key: 'appearance', href: '/settings/appearance', icon: Palette },
      {
        key: 'activity',
        href: '/activity',
        icon: Activity,
        permission: 'activity:view',
      },
    ],
  },
  {
    tier: 'editor',
    items: [
      {
        key: 'editorDefaults',
        href: '/settings/editor-defaults',
        icon: Sliders,
        permission: 'person:create',
      },
      {
        key: 'dataStorage',
        href: '/settings/data',
        icon: Database,
        permission: 'gedcom:export',
      },
    ],
  },
  {
    tier: 'admin',
    items: [
      { key: 'family', href: '/settings/family', icon: Home, permission: 'members:manage' },
      { key: 'members', href: '/settings/members', icon: Users, permission: 'members:manage' },
      { key: 'searchSources', href: '/settings/sources', icon: Search, permission: 'members:manage' },
    ],
  },
  {
    tier: 'owner',
    items: [
      { key: 'privacy', href: '/settings/privacy', icon: Shield, permission: 'settings:manage' },
      { key: 'ai', href: '/settings/ai', icon: Bot, permission: 'settings:manage' },
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
