'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

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

type Variant = 'sidebar' | 'header';

interface LocaleSwitcherProps {
  /**
   * 'sidebar' (default): SidebarMenuItem dropdown on md+ and a 2-column inline
   * segmented control on mobile — for the sidebar footer and the mobile
   * tab-bar's More sheet, both of which expect SidebarMenu children.
   *
   * 'header': single ghost Button trigger styled to match ModeToggle for the
   * app header. Renders identically across viewports.
   */
  variant?: Variant;
}

/**
 * Locale switcher. Strategy: client-side route swap — strip the current
 * locale prefix from the pathname and push the new prefix. Preserves the
 * in-route path so /persons/abc stays at /persons/abc but under /ru/.
 *
 * Sync NEXT_LOCALE cookie BEFORE navigation. Switching ru → en sends the
 * request to /foo (no prefix); next-intl middleware then runs
 * resolveLocaleFromPrefix which falls through to the cookie. A stale 'ru'
 * cookie causes a 307 redirect /foo → /ru/foo, trapping the user in the old
 * locale.
 */
export function LocaleSwitcher({ variant = 'sidebar' }: LocaleSwitcherProps = {}) {
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const t = useTranslations('common.localeSwitcher');

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

  const items = routing.locales.map((loc) => (
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
  ));

  if (variant === 'header') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            aria-label={`${t('label')}: ${LOCALE_LABELS[currentLocale]}`}
            aria-haspopup="menu"
          >
            <Languages className="size-4" />
            <span className="text-xs font-medium">
              {currentLocale.toUpperCase()}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-44">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {LOCALE_LABELS[currentLocale]}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      {/* Desktop sidebar: dropdown menu */}
      <SidebarMenuItem className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="sm"
              tooltip={LOCALE_LABELS[currentLocale]}
              title={LOCALE_LABELS[currentLocale]}
              aria-label={LOCALE_LABELS[currentLocale]}
              aria-haspopup="menu"
            >
              <Languages />
              <span className="truncate font-medium">{currentLocale.toUpperCase()}</span>
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
            {items}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {/* Mobile sidebar: compact inline segmented control */}
      <SidebarMenuItem className="md:hidden">
        <div className="flex items-center gap-2 px-2 py-1">
          <Languages
            className="size-4 shrink-0 text-sidebar-foreground/60"
            aria-hidden
          />
          <span className="sr-only">{t('label')}</span>
          <div
            role="radiogroup"
            aria-label={t('label')}
            className="flex h-10 min-w-0 flex-1 items-stretch rounded-md border border-sidebar-border bg-sidebar-accent/10 p-0.5"
          >
            {routing.locales.map((loc) => {
              const isActive = loc === currentLocale;
              return (
                <button
                  key={loc}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => switchTo(loc)}
                  className={cn(
                    'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm px-2 text-xs font-medium transition-colors',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    isActive
                      ? 'bg-sidebar text-sidebar-accent-foreground shadow-sm'
                      : 'text-sidebar-foreground/70 active:bg-sidebar-accent/30',
                  )}
                >
                  <span className="text-sm leading-none" aria-hidden>
                    {LOCALE_FLAGS[loc]}
                  </span>
                  <span className="truncate">{LOCALE_LABELS[loc]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </SidebarMenuItem>
    </>
  );
}
