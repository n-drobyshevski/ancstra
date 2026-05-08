import { Eye, PenLine, UserCog, type LucideIcon } from 'lucide-react';
import type { Role } from '@ancstra/auth/types';

/** Roles a user can lens AS — owner is excluded since the lens is downgrade-only. */
export type LensableRole = Exclude<Role, 'owner'>;

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export interface LensTheme {
  /** Active-trigger / selected-item icon — captures the role's essence. */
  icon: LucideIcon;
  /** Trigger button background + text when this lens is active. */
  triggerClass: string;
  /** Color of the role's icon in dropdown items (slightly muted vs the dot). */
  itemIconClass: string;
  /** Background tint for the dropdown item when this role is the selected lens. */
  itemActiveClass: string;
  /** Solid color for the pulsing "lens active" dot on the trigger. */
  dotClass: string;
  /** Background + text classes for the sticky lens-active banner. */
  bannerClass: string;
}

/**
 * Per-role visual identity for the lens system.
 *
 * Color reasoning:
 *  - admin  → sky     (cool blue = trusted, professional, elevated authority)
 *  - editor → emerald (green   = creative, productive, hands-on with content)
 *  - viewer → amber   (warm    = caution / restricted "look but don't touch")
 *
 * Avoiding `primary` (indigo, brand) and `destructive` (red, used by Reset)
 * to keep semantic channels distinct. All foreground/background pairs meet
 * WCAG AA in light and dark modes via the `{color}-700` / `dark:{color}-300`
 * pairing on a `{color}-500/15` tint background — same convention the sidebar
 * already uses for `primary/20` badges.
 */
export const LENS_THEME: Record<LensableRole, LensTheme> = {
  admin: {
    icon: UserCog,
    triggerClass:
      'bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200',
    itemIconClass: 'text-sky-600 dark:text-sky-400',
    itemActiveClass:
      'bg-sky-500/15 text-sky-800 focus:bg-sky-500/20 dark:text-sky-200',
    dotClass: 'bg-sky-500',
    bannerClass:
      'bg-sky-500/15 text-sky-800 dark:text-sky-200 border-b border-sky-500/30',
  },
  editor: {
    icon: PenLine,
    triggerClass:
      'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200',
    itemIconClass: 'text-emerald-600 dark:text-emerald-400',
    itemActiveClass:
      'bg-emerald-500/15 text-emerald-800 focus:bg-emerald-500/20 dark:text-emerald-200',
    dotClass: 'bg-emerald-500',
    bannerClass:
      'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-b border-emerald-500/30',
  },
  viewer: {
    icon: Eye,
    triggerClass:
      'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200',
    itemIconClass: 'text-amber-600 dark:text-amber-400',
    itemActiveClass:
      'bg-amber-500/15 text-amber-800 focus:bg-amber-500/20 dark:text-amber-200',
    dotClass: 'bg-amber-500',
    bannerClass:
      'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-b border-amber-500/30',
  },
};
