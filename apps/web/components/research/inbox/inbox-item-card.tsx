'use client';

import { Button } from '@/components/ui/button';
import { DISCOVERY_METHOD_LABELS } from '@/lib/research/constants';
import type { InboxItem } from '@/lib/research/factsheet-client';

interface InboxItemCardProps {
  item: InboxItem;
  onReview: () => void;
  onDismiss: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function InboxItemCard({ item, onReview, onDismiss }: InboxItemCardProps) {
  const methodLabel = DISCOVERY_METHOD_LABELS[item.discoveryMethod] ?? item.discoveryMethod;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {methodLabel} · {timeAgo(item.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onReview}>
          Review
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
