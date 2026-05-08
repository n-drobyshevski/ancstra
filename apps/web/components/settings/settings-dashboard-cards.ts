import {
  Activity,
  Bot,
  Database,
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

export interface DashboardCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Highlights the card visually as the primary suggested action for the role. */
  primary?: boolean;
}

export interface DashboardWelcome {
  /** Section heading shown above the card grid. */
  title: string;
  /** One-sentence framing for what this role does in the family. */
  tagline: string;
}

const PROFILE_CARD: DashboardCard = {
  title: 'Profile',
  description: 'Display name, language, time zone, and notifications.',
  href: '/settings/profile',
  icon: User,
};

const APPEARANCE_CARD: DashboardCard = {
  title: 'Appearance',
  description: 'Theme and display density.',
  href: '/settings/appearance',
  icon: Palette,
};

const ACTIVITY_CARD: DashboardCard = {
  title: 'Activity',
  description: 'See recent changes in your family tree.',
  href: '/activity',
  icon: Activity,
};

const FAMILY_CARD: DashboardCard = {
  title: 'Family',
  description: 'Name, member limits, moderation rules.',
  href: '/settings/family',
  icon: Home,
};

const MEMBERS_CARD: DashboardCard = {
  title: 'Members',
  description: 'Invite collaborators and manage roles.',
  href: '/settings/members',
  icon: Users,
};

const DATA_CARD: DashboardCard = {
  title: 'Data & Storage',
  description: 'Backups, cache, and archive cleanup.',
  href: '/settings/data',
  icon: Database,
};

const EDITOR_DEFAULTS_CARD: DashboardCard = {
  title: 'Editor defaults',
  description: 'Default privacy, GEDCOM export, and citation style.',
  href: '/settings/editor-defaults',
  icon: Sliders,
};

const SOURCES_CARD: DashboardCard = {
  title: 'Search Sources',
  description: 'Connect external genealogy databases.',
  href: '/settings/sources',
  icon: Search,
};

const PRIVACY_CARD: DashboardCard = {
  title: 'Privacy',
  description: 'How living persons are handled across the family.',
  href: '/settings/privacy',
  icon: Shield,
};

const AI_CARD: DashboardCard = {
  title: 'AI',
  description: 'Monthly AI budget and usage.',
  href: '/settings/ai',
  icon: Bot,
};

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
      ];
    case 'editor':
      return [
        { ...EDITOR_DEFAULTS_CARD, primary: true },
        DATA_CARD,
        PROFILE_CARD,
        APPEARANCE_CARD,
        ACTIVITY_CARD,
      ];
    case 'viewer':
      return [
        { ...PROFILE_CARD, primary: true },
        APPEARANCE_CARD,
        ACTIVITY_CARD,
      ];
  }
}

/**
 * Role-tailored welcome copy for the /settings landing page.
 * Heritage Modern voice: confident, warm, never patronising.
 */
export function getDashboardWelcome(role: Role): DashboardWelcome {
  switch (role) {
    case 'owner':
      return {
        title: 'Owner settings',
        tagline: "You manage this family tree. Everything below is yours to configure.",
      };
    case 'admin':
      return {
        title: 'Admin settings',
        tagline: 'You help run this family. Manage members, data, and your own profile here.',
      };
    case 'editor':
      return {
        title: 'Editor settings',
        tagline: 'You contribute to this family tree. Adjust your defaults and personal preferences.',
      };
    case 'viewer':
      return {
        title: 'Your settings',
        tagline: 'You can view this family tree. Personalise your account below.',
      };
  }
}
