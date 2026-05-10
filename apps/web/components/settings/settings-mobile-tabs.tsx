'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useVisibleSettingsSections } from './settings-nav';
import { cn } from '@/lib/utils';

/**
 * Horizontally scrollable tab strip for settings sub-pages on mobile. Lets
 * users hop between sections without bouncing back to the /settings
 * dashboard. Hidden on the /settings landing page (the dashboard cards
 * already serve as a table of contents) and on desktop (the persistent
 * sidebar serves the same role).
 *
 * The visible item list is shared with the desktop sidebar via
 * `useVisibleSettingsSections`, so role/permission filtering stays in sync.
 */
export function SettingsMobileTabs() {
  const pathname = usePathname();
  const sections = useVisibleSettingsSections();
  const tItems = useTranslations('settings.nav.items');

  // Locale-stripped pathname (e.g. `/ru/settings/family` → `/settings/family`).
  const localelessPath =
    pathname.replace(/^\/(en|ru)(?=\/|$)/, '') || '/';

  // Don't render on the settings dashboard — SettingsMobileNav owns that view.
  if (localelessPath === '/settings') return null;

  // Flatten visible items across tiers; tab strip drops section grouping in
  // favor of a flat horizontally-scrollable list.
  const items = sections.flatMap((section) => section.items);
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Settings sections"
      className="md:hidden -mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex items-center gap-1.5">
        {items.map((item) => {
          const isActive = localelessPath.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="size-3.5" />
                {tItems(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
