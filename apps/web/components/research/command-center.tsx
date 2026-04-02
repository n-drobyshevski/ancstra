// apps/web/components/research/command-center.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, User } from 'lucide-react';
import { getLastWorkspace, type LastWorkspace } from '@/lib/research/activity';
import { ActivityFeed } from './activity-feed';
import { QuickActions } from './quick-actions';
import { BookmarksPanel } from './bookmarks-panel';

interface CommandCenterProps {
  onSearch: (query: string) => void;
  onScrapeUrl: () => void;
  onPasteText: () => void;
  onOpenAi: () => void;
  bookmarkRefreshKey: number;
  aiPanelOpen?: boolean;
}

export function CommandCenter({
  onSearch,
  onScrapeUrl,
  onPasteText,
  onOpenAi,
  bookmarkRefreshKey,
  aiPanelOpen,
}: CommandCenterProps) {
  const [lastWorkspace, setLastWs] = useState<LastWorkspace | null>(null);

  useEffect(() => {
    setLastWs(getLastWorkspace());
  }, []);

  const workspaceUrl = lastWorkspace
    ? `/research/person/${lastWorkspace.personId}${lastWorkspace.view !== 'record' ? `?view=${lastWorkspace.view}` : ''}`
    : null;

  return (
    <div className="space-y-4">
      {/* Continue where you left off */}
      {lastWorkspace && workspaceUrl && (
        <Link
          href={workspaceUrl}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:bg-muted/50 hover:shadow-sm active:scale-[0.99]"
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <User className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Continue where you left off</p>
            <p className="truncate text-sm font-medium">{lastWorkspace.personName}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <div className={`grid gap-4 md:grid-cols-2 ${aiPanelOpen ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
      {/* Mobile: Quick Actions first for discoverability; desktop: Activity first */}
      <div className="rounded-xl border border-border bg-card p-4 order-2 md:order-1">
        <ActivityFeed onRerunSearch={onSearch} />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 order-1 md:order-2">
        <QuickActions
          onScrapeUrl={onScrapeUrl}
          onPasteText={onPasteText}
          onOpenAi={onOpenAi}
        />
      </div>
      <div className="rounded-xl border border-border bg-card p-4 order-3 md:col-span-2 lg:col-span-1">
        <BookmarksPanel mode="landing" refreshKey={bookmarkRefreshKey} />
      </div>
      </div>
    </div>
  );
}
