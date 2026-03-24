'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useHeaderContent } from '@/lib/header-context';

export function AppHeader({ title }: { title?: string }) {
  const { headerContent } = useHeaderContent();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1 min-w-0">{headerContent ?? <span className="text-sm font-medium">{title ?? 'Ancstra'}</span>}</div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() =>
          window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
          )
        }
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline text-xs">Search</span>
        <kbd className="hidden sm:inline pointer-events-none text-[10px] text-muted-foreground/60 bg-muted px-1 rounded">
          ⌘K
        </kbd>
      </Button>
      <ModeToggle />
    </header>
  );
}
