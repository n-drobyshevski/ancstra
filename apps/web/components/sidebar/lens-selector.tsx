'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Check, Glasses, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { LENS_THEME, type LensableRole } from '@/lib/lens/theme';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { cn } from '@/lib/utils';

export function LensSelector() {
  const isHydrated = useIsHydrated();
  const { actualRole, lens, setLens, familyId } = useLens();
  const t = useTranslations('common.lens');
  const tRoles = useTranslations('common.lens.roles');

  // Hide on SSR + first client render: actualRole is derived from
  // useSession(), which returns the resolved session on SSR but null/loading
  // on first client render (SessionProvider isn't seeded with a server
  // session — see `[locale]/layout.tsx` for why). Without this gate, the
  // server emits the lens trigger button and the client renders nothing,
  // shifting LocaleSwitcher into LensSelector's DOM slot. Same gating as
  // `useVisibleNavItems` in app-sidebar.tsx.
  if (!isHydrated) return null;
  // Hide entirely when there's nothing meaningful to show:
  //  - no current family context
  //  - actual role is viewer (no roles below)
  if (!familyId || !actualRole || actualRole === 'viewer') return null;

  const lenses = availableLenses(actualRole);
  const isActive = lens !== null;
  const activeTheme = isActive ? LENS_THEME[lens as LensableRole] : null;
  const ActiveIcon = activeTheme?.icon ?? Glasses;
  const triggerLabel = isActive ? t('viewingAs', { role: tRoles(lens as Role) }) : t('yourView');
  const triggerTooltip = isActive
    ? t('tooltipActive', { role: tRoles(lens as Role) })
    : t('tooltipYourView');

  function activate(role: Role) {
    setLens(role);
    toast.success(t('activated', { role: tRoles(role) }), {
      description: t('activatedDescription'),
    });
  }

  function reset() {
    setLens(null);
    toast.success(t('reset'), {
      description: t('resetDescription', { role: tRoles(actualRole!) }),
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
              {t('viewAs')}
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('youPrefix', { role: tRoles(actualRole) })}
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
                <span className="flex-1">{tRoles(role)}</span>
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
                <span>{t('resetLabel')}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
