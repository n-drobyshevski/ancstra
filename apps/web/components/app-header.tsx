'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useHeaderContent } from '@/lib/header-context';
import { FamilyPicker } from '@/components/auth/family-picker';
import { SIDEBAR_VARIANT } from '@/components/layout/mobile-nav';
import { cn } from '@/lib/utils';

export function AppHeader({ title }: { title?: string }) {
  const { headerContent } = useHeaderContent();
  const t = useTranslations('navigation.header');

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger
        className={cn(
          '-ml-2 md:-ml-1',
          // tabbar-full variant replaces the hamburger drawer with a 5-tab
          // bottom bar on mobile — hide the trigger so users don't open an
          // empty drawer behind the tab bar.
          SIDEBAR_VARIANT === 'tabbar-full' && 'max-md:hidden',
        )}
      />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1 min-w-0">{headerContent ?? <span className="text-sm font-medium">{title ?? t('defaultTitle')}</span>}</div>
      <Button
        variant="outline"
        size="sm"
        // Below sm: search collapses to a square icon-only button (no text,
        // no kbd hint, zero gap) so the header items don't collide on phones.
        className="gap-2 max-sm:gap-0 max-sm:size-9 max-sm:p-0 text-muted-foreground"
        aria-label={t('search')}
        onClick={() =>
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
          )
        }
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline text-xs">{t('search')}</span>
        <kbd className="hidden sm:inline pointer-events-none text-[10px] text-muted-foreground/60 bg-muted px-1 rounded">
          ⌘K
        </kbd>
      </Button>
      <Suspense fallback={null}>
        <FamilyPicker />
      </Suspense>
      <ModeToggle />
    </header>
  );
}
