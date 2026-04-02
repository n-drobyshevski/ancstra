'use client';

import { ClipboardPaste, Link, Sparkles, Bookmark } from 'lucide-react';

interface MobileBottomBarProps {
  onPasteText: () => void;
  onScrapeUrl: () => void;
  onOpenAi: () => void;
  bookmarkCount: number;
}

const items = [
  { key: 'paste', icon: ClipboardPaste, label: 'Paste', action: 'onPasteText' as const },
  { key: 'scrape', icon: Link, label: 'Scrape', action: 'onScrapeUrl' as const },
  { key: 'ai', icon: Sparkles, label: 'AI', action: 'onOpenAi' as const },
] as const;

export function MobileBottomBar({ onPasteText, onScrapeUrl, onOpenAi, bookmarkCount }: MobileBottomBarProps) {
  const handlers = { onPasteText, onScrapeUrl, onOpenAi };

  return (
    <div
      role="toolbar"
      aria-label="Research actions"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background px-2 pb-[env(safe-area-inset-bottom)] pt-2"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={handlers[item.action]}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
      {/* Bookmarks with badge */}
      <button
        type="button"
        onClick={() => {/* Navigate to bookmarks or scroll to section */}}
        className="relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bookmark className="size-5" />
        {bookmarkCount > 0 && (
          <span className="absolute -right-0.5 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {bookmarkCount > 99 ? '99+' : bookmarkCount}
          </span>
        )}
        <span className="text-[10px] font-medium">Marks</span>
      </button>
    </div>
  );
}
