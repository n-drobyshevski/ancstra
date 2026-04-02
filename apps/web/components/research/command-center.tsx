// apps/web/components/research/command-center.tsx
'use client';

import { ActivityFeed } from './activity-feed';
import { QuickActions } from './quick-actions';
import { BookmarksPanel } from './bookmarks-panel';

interface CommandCenterProps {
  onSearch: (query: string) => void;
  onScrapeUrl: () => void;
  onPasteText: () => void;
  onOpenAi: () => void;
  bookmarkRefreshKey: number;
}

export function CommandCenter({
  onSearch,
  onScrapeUrl,
  onPasteText,
  onOpenAi,
  bookmarkRefreshKey,
}: CommandCenterProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <ActivityFeed onRerunSearch={onSearch} />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <QuickActions
          onScrapeUrl={onScrapeUrl}
          onPasteText={onPasteText}
          onOpenAi={onOpenAi}
        />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <BookmarksPanel mode="landing" refreshKey={bookmarkRefreshKey} />
      </div>
    </div>
  );
}
