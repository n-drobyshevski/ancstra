// apps/web/components/research/quick-actions.tsx
'use client';

import { Link, ClipboardPaste, Sparkles } from 'lucide-react';

interface QuickActionsProps {
  onScrapeUrl: () => void;
  onPasteText: () => void;
  onOpenAi: () => void;
}

const actions = [
  {
    key: 'scrape',
    icon: Link,
    iconBg: 'bg-green-50 dark:bg-green-950/30',
    title: 'Scrape a URL',
    subtitle: 'Paste any link to auto-extract',
    action: 'onScrapeUrl' as const,
  },
  {
    key: 'paste',
    icon: ClipboardPaste,
    iconBg: 'bg-amber-50 dark:bg-amber-950/30',
    title: 'Paste Text / OCR',
    subtitle: 'Add text from documents',
    action: 'onPasteText' as const,
  },
  {
    key: 'ai',
    icon: Sparkles,
    iconBg: 'bg-violet-50 dark:bg-violet-950/30',
    title: 'Ask AI',
    subtitle: 'Research assistant',
    action: 'onOpenAi' as const,
  },
];

export function QuickActions({ onScrapeUrl, onPasteText, onOpenAi }: QuickActionsProps) {
  const handlers = { onScrapeUrl, onPasteText, onOpenAi };

  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quick Actions
      </h2>
      <div className="flex flex-col gap-2">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={handlers[item.action]}
              className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className={`flex size-7 items-center justify-center rounded-md ${item.iconBg}`}>
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
