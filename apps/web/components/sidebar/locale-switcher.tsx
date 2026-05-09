'use client';

import { Languages } from 'lucide-react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { routing, type Locale } from '@/i18n/routing';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
};

const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  ru: '🇷🇺',
};

/**
 * Locale switcher rendered in the sidebar footer (next to lens-selector).
 *
 * Strategy: client-side route swap. Use the current pathname, strip the
 * existing locale prefix if present, and push to the new prefix. This
 * preserves the in-route path (so /persons/abc stays at /persons/abc but
 * under /ru/persons/abc).
 */
export function LocaleSwitcher() {
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === currentLocale) return;
    // Strip leading /:locale segment if present
    const stripRe = new RegExp(`^/(?:${routing.locales.join('|')})(?=/|$)`);
    const cleanPath = pathname.replace(stripRe, '') || '/';
    // localePrefix: 'as-needed' → default locale has no prefix
    const targetPath =
      next === routing.defaultLocale
        ? cleanPath
        : `/${next}${cleanPath === '/' ? '' : cleanPath}`;
    startTransition(() => {
      router.replace(targetPath);
      // Hard refresh so server components re-render with the new locale
      router.refresh();
    });
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={LOCALE_LABELS[currentLocale]}
            aria-haspopup="menu"
          >
            <Languages />
            <span className="truncate">{LOCALE_LABELS[currentLocale]}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="end"
          sideOffset={8}
          className="min-w-44"
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {LOCALE_LABELS[currentLocale]}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {routing.locales.map((loc) => (
            <DropdownMenuItem
              key={loc}
              onSelect={() => switchTo(loc)}
              aria-checked={loc === currentLocale}
              role="menuitemradio"
              className="gap-2"
            >
              <span className="text-base leading-none" aria-hidden>
                {LOCALE_FLAGS[loc]}
              </span>
              <span className="flex-1">{LOCALE_LABELS[loc]}</span>
              {loc === currentLocale && (
                <span className="text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
