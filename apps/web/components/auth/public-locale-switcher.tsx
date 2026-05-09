'use client';

import { Languages, Check } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { routing, type Locale } from '@/i18n/routing';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
};

const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  ru: '🇷🇺',
};

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeLocaleCookie(locale: Locale): void {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Floating locale switcher for unauthenticated pages (/login, /signup,
 * /join, /create-family). The sidebar variant in components/sidebar/ is
 * coupled to <SidebarMenuButton> and not usable outside that layout.
 *
 * Visual: small ghost button anchored top-right with the current locale's
 * native name + flag. Opens a dropdown with both locales; the active one
 * is marked with a check.
 *
 * a11y:
 *   - The trigger has `aria-label="{localeNative}, change language"` so
 *     screen-reader users hear both the current value and the action.
 *   - Each dropdown item is `role="menuitemradio"` with `aria-checked`,
 *     so JAWS / NVDA report it as a radio group rather than a menu.
 *   - Flags are `aria-hidden` so the locale label isn't doubled.
 *   - The label uses the locale's NATIVE name (Русский, not Russian)
 *     because a user trapped in the wrong locale can still recognize it.
 *
 * Cookie write happens BEFORE navigation per
 * feedback_next_intl_as_needed_cookie — without that, ru → en bounces back
 * via the stale cookie.
 */
export function PublicLocaleSwitcher() {
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === currentLocale) return;

    const stripRe = new RegExp(`^/(?:${routing.locales.join('|')})(?=/|$)`);
    const cleanPath = pathname.replace(stripRe, '') || '/';
    const targetPath =
      next === routing.defaultLocale
        ? cleanPath
        : `/${next}${cleanPath === '/' ? '' : cleanPath}`;

    writeLocaleCookie(next);

    startTransition(() => {
      router.replace(targetPath);
      router.refresh();
    });
  }

  return (
    <div className="fixed right-4 top-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            aria-label={`${LOCALE_LABELS[currentLocale]}, change language`}
            disabled={pending}
          >
            <Languages className="h-4 w-4" aria-hidden />
            <span>{LOCALE_LABELS[currentLocale]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} className="min-w-44">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {LOCALE_LABELS[currentLocale]}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {routing.locales.map((loc) => (
            <DropdownMenuItem
              key={loc}
              onSelect={() => switchTo(loc)}
              role="menuitemradio"
              aria-checked={loc === currentLocale}
              className="gap-2"
            >
              <span className="text-base leading-none" aria-hidden>
                {LOCALE_FLAGS[loc]}
              </span>
              <span className="flex-1">{LOCALE_LABELS[loc]}</span>
              {loc === currentLocale && (
                <Check className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
