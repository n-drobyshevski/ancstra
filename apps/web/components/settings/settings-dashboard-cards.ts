import {
  Activity,
  Bot,
  Database,
  FlaskConical,
  Home,
  Palette,
  Search,
  Shield,
  Sliders,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@ancstra/auth/types';

export type DashboardCardKey =
  | 'profile'
  | 'appearance'
  | 'activity'
  | 'labs'
  | 'family'
  | 'members'
  | 'dataStorage'
  | 'editorDefaults'
  | 'searchSources'
  | 'privacy'
  | 'ai';

export interface DashboardCard {
  /** Translation key under `settings.cards.<key>` for title + description. */
  key: DashboardCardKey;
  href: string;
  icon: LucideIcon;
  /** Highlights the card visually as the primary suggested action for the role. */
  primary?: boolean;
  /**
   * Marks this card as opt-in experimental. The hub renders an
   * <ExperimentalBadge> next to the title and tints the icon container amber.
   * Mutually exclusive with `primary` in practice — experimental features are
   * never the primary suggested action.
   */
  experimental?: boolean;
}

const PROFILE_CARD: DashboardCard = { key: 'profile', href: '/settings/profile', icon: User };
const APPEARANCE_CARD: DashboardCard = { key: 'appearance', href: '/settings/appearance', icon: Palette };
const ACTIVITY_CARD: DashboardCard = { key: 'activity', href: '/activity', icon: Activity };
const LABS_CARD: DashboardCard = { key: 'labs', href: '/settings/labs', icon: FlaskConical, experimental: true };
const FAMILY_CARD: DashboardCard = { key: 'family', href: '/settings/family', icon: Home };
const MEMBERS_CARD: DashboardCard = { key: 'members', href: '/settings/members', icon: Users };
const DATA_CARD: DashboardCard = { key: 'dataStorage', href: '/settings/data', icon: Database };
const EDITOR_DEFAULTS_CARD: DashboardCard = { key: 'editorDefaults', href: '/settings/editor-defaults', icon: Sliders };
const SOURCES_CARD: DashboardCard = { key: 'searchSources', href: '/settings/sources', icon: Search };
const PRIVACY_CARD: DashboardCard = { key: 'privacy', href: '/settings/privacy', icon: Shield };
const AI_CARD: DashboardCard = { key: 'ai', href: '/settings/ai', icon: Bot };

/**
 * Role-tailored card grid for the /settings landing page. Each role sees the
 * surfaces relevant to them, ordered with the most likely action first. Marks
 * exactly one card as `primary: true` to anchor the page visually.
 */
export function getDashboardCards(role: Role): DashboardCard[] {
  switch (role) {
    case 'owner':
      return [
        { ...FAMILY_CARD, primary: true },
        AI_CARD,
        MEMBERS_CARD,
        PRIVACY_CARD,
        SOURCES_CARD,
        EDITOR_DEFAULTS_CARD,
        DATA_CARD,
        PROFILE_CARD,
        APPEARANCE_CARD,
        ACTIVITY_CARD,
        LABS_CARD,
      ];
    case 'admin':
      return [
        { ...MEMBERS_CARD, primary: true },
        FAMILY_CARD,
        SOURCES_CARD,
        EDITOR_DEFAULTS_CARD,
        DATA_CARD,
        PROFILE_CARD,
        APPEARANCE_CARD,
        ACTIVITY_CARD,
        LABS_CARD,
      ];
    case 'editor':
      return [
        { ...EDITOR_DEFAULTS_CARD, primary: true },
        DATA_CARD,
        PROFILE_CARD,
        APPEARANCE_CARD,
        ACTIVITY_CARD,
        LABS_CARD,
      ];
    case 'viewer':
      return [
        { ...PROFILE_CARD, primary: true },
        APPEARANCE_CARD,
        ACTIVITY_CARD,
        LABS_CARD,
      ];
  }
}
