'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffectiveMembership } from '@/lib/auth/use-has-permission';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { cn } from '@/lib/utils';
import {
  getVisibleSettingsSections,
  type NavItem,
  type NavSection,
} from './settings-nav-sections';

export type { NavItem, NavSection };

/**
 * Visible nav sections for the active membership, lens-aware.
 *
 * Gated by `useIsHydrated` because `useEffectiveMembership` ultimately reads
 * `useSession()`, which differs between SSR and the first client render until
 * the SessionProvider hydrates. Permissioned items pop in post-hydration.
 */
export function useVisibleSettingsSections(): NavSection[] {
  const isHydrated = useIsHydrated();
  const membership = useEffectiveMembership();
  return getVisibleSettingsSections(membership?.role ?? null, isHydrated);
}

export function SettingsNav() {
  const pathname = usePathname();
  const sections = useVisibleSettingsSections();

  return (
    <nav className="hidden md:block w-[220px] shrink-0 border-r border-border pr-4 space-y-6">
      {sections.map((section) => (
        <div key={section.tier} className="space-y-1">
          <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </div>
          {section.items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
