// apps/web/components/research/activity-feed.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Link as LinkIcon, FileText } from 'lucide-react';
import { getActivity, type ActivityEntry } from '@/lib/research/activity';
import { SmartSuggestions } from './smart-suggestions';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<ActivityEntry['type'], { icon: typeof Search; className: string }> = {
  search: { icon: Search, className: 'text-primary' },
  scrape: { icon: LinkIcon, className: 'text-green-600' },
  paste: { icon: FileText, className: 'text-amber-600' },
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityFeedProps {
  onRerunSearch: (query: string) => void;
}

export function ActivityFeed({ onRerunSearch }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const router = useRouter();

  useEffect(() => {
    setEntries(getActivity().slice(0, 5));
  }, []);

  if (entries.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Suggested Searches
        </h2>
        <SmartSuggestions onSelect={onRerunSearch} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent Activity
      </h2>
      <div className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto">
        {entries.map((entry, i) => {
          const config = TYPE_CONFIG[entry.type];
          const Icon = config.icon;
          return (
            <button
              key={`${entry.timestamp}-${i}`}
              type="button"
              onClick={() => {
                if (entry.type === 'search') {
                  onRerunSearch(entry.title);
                } else if (entry.itemId) {
                  router.push(`/research/item/${entry.itemId}`);
                }
              }}
              aria-label={`${entry.type === 'search' ? 'Re-run search' : 'Open'}: ${entry.title}`}
              className="flex items-center gap-2.5 rounded-md bg-muted/50 px-3 py-2 text-left text-sm transition-all hover:bg-muted active:scale-[0.98]"
            >
              <Icon className={cn('size-4 shrink-0', config.className)} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimeAgo(entry.timestamp)}
                  {entry.resultCount != null && ` · ${entry.resultCount} results`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
