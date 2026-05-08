'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Check,
  Eye,
  Glasses,
  PenLine,
  RotateCcw,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@ancstra/auth/types';
import { availableLenses } from '@ancstra/auth/lens';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { useLens } from '@/lib/lens/provider';
import { cn } from '@/lib/utils';

type LensableRole = Exclude<Role, 'owner'>;

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

interface LensTheme {
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
const LENS_THEME: Record<LensableRole, LensTheme> = {
  admin: {
    icon: UserCog,
    triggerClass:
      'bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 hover:text-sky-800 dark:text-sky-300 dark:hover:text-sky-200',
    itemIconClass: 'text-sky-600 dark:text-sky-400',
    itemActiveClass:
      'bg-sky-500/15 text-sky-800 focus:bg-sky-500/20 dark:text-sky-200',
    dotClass: 'bg-sky-500',
  },
  editor: {
    icon: PenLine,
    triggerClass:
      'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200',
    itemIconClass: 'text-emerald-600 dark:text-emerald-400',
    itemActiveClass:
      'bg-emerald-500/15 text-emerald-800 focus:bg-emerald-500/20 dark:text-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  viewer: {
    icon: Eye,
    triggerClass:
      'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200',
    itemIconClass: 'text-amber-600 dark:text-amber-400',
    itemActiveClass:
      'bg-amber-500/15 text-amber-800 focus:bg-amber-500/20 dark:text-amber-200',
    dotClass: 'bg-amber-500',
  },
};

export function LensSelector() {
  const { actualRole, lens, setLens, familyId } = useLens();

  // Hide entirely when there's nothing meaningful to show:
  //  - no current family context
  //  - actual role is viewer (no roles below)
  if (!familyId || !actualRole || actualRole === 'viewer') return null;

  const lenses = availableLenses(actualRole);
  const isActive = lens !== null;
  const activeTheme = isActive ? LENS_THEME[lens as LensableRole] : null;
  const ActiveIcon = activeTheme?.icon ?? Glasses;
  const triggerLabel = isActive ? `Viewing as ${ROLE_LABEL[lens]}` : 'Your view';
  const triggerTooltip = isActive
    ? `Lens active: ${ROLE_LABEL[lens]} — click to change`
    : 'Lens: your view';

  function activate(role: Role) {
    setLens(role);
    toast.success(`Now viewing as ${ROLE_LABEL[role]}`, {
      description: 'Permissions are temporarily downgraded.',
    });
  }

  function reset() {
    setLens(null);
    toast.success('Lens reset', {
      description: `Restored your ${ROLE_LABEL[actualRole!]} access.`,
    });
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={triggerTooltip}
            aria-haspopup="menu"
            data-lens-active={isActive ? '' : undefined}
            className={cn(activeTheme?.triggerClass)}
          >
            <span className="relative inline-flex shrink-0">
              <ActiveIcon aria-hidden />
              {isActive && activeTheme && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-sidebar',
                    activeTheme.dotClass,
                    'motion-safe:animate-pulse',
                  )}
                />
              )}
            </span>
            <span className="truncate">{triggerLabel}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="end"
          sideOffset={8}
          className="min-w-56"
        >
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span className="text-xs font-normal text-muted-foreground">
              View this family as
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              You: {ROLE_LABEL[actualRole]}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {lenses.map((role) => {
            const theme = LENS_THEME[role as LensableRole];
            const selected = lens === role;
            const ItemIcon = theme.icon;
            return (
              <DropdownMenuItem
                key={role}
                onSelect={() => activate(role)}
                aria-checked={selected}
                role="menuitemradio"
                className={cn('gap-2', selected && theme.itemActiveClass)}
              >
                <ItemIcon
                  className={cn('size-4', theme.itemIconClass)}
                  aria-hidden
                />
                <span className="flex-1">{ROLE_LABEL[role]}</span>
                {selected && <Check className="size-4" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={reset}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <RotateCcw className="size-4" aria-hidden />
                <span>Reset to your view</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
