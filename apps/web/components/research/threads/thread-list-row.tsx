'use client';

import Link from 'next/link';
import { Notebook, FileStack, Search, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThreadListItem, ThreadStatus } from '@/lib/research/use-thread-list';

interface ThreadListRowProps {
  thread: ThreadListItem;
  selected: boolean;
  /**
   * Wide-viewport behaviour: parent passes a click handler that updates
   * `?selected=` and renders the preview pane. On narrow viewports the
   * parent omits this so the row falls back to a navigational <Link> to
   * the full detail page.
   */
  onSelect?: (id: string) => void;
  /** Marker for the currently-active thread (cookie state). */
  isActive: boolean;
}

const STATUS_LABEL: Record<ThreadStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  resolved: 'Resolved',
  abandoned: 'Abandoned',
};

// Status colour mapping — semantic tokens paired with the text label so
// meaning never depends on colour alone (WCAG 1.4.1 / UI/UX Pro Max §1
// `color-not-only`). Dark-mode pairs verified against shadcn defaults.
const STATUS_CLASSES: Record<ThreadStatus, string> = {
  active:    'border-indigo-400/60 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200',
  paused:    'border-amber-400/60 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  resolved:  'border-emerald-400/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  abandoned: 'border-border text-muted-foreground',
};

function seedDescriptor(thread: ThreadListItem): { Icon: typeof Notebook; label: string } {
  if (thread.seedPersonId) return { Icon: User, label: 'person' };
  if (thread.seedFactsheetId) return { Icon: FileStack, label: 'factsheet' };
  if (thread.seedResearchItemId) return { Icon: Search, label: 'research item' };
  return { Icon: Notebook, label: 'manual' };
}

function relativeDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '';
  const diffMs = Date.now() - ts;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function ThreadListRow({ thread, selected, onSelect, isActive }: ThreadListRowProps) {
  const seed = seedDescriptor(thread);
  const status = thread.status;

  const body = (
    <div className="flex items-start gap-3">
      <Notebook className="size-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{thread.title}</span>
          {isActive && (
            <Badge variant="outline" className="border-amber-400/70 text-amber-700 dark:text-amber-300 shrink-0">
              Active now
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span
            className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide', STATUS_CLASSES[status])}
            aria-label={`Status: ${STATUS_LABEL[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="inline-flex items-center gap-1">
            <seed.Icon className="size-3" aria-hidden />
            <span>seed: {seed.label}</span>
          </span>
          <span title={new Date(thread.updatedAt).toLocaleString()}>
            <span className="tabular-nums">{relativeDate(thread.updatedAt)}</span>
          </span>
        </div>
        {thread.summary && (
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {thread.summary}
          </div>
        )}
      </div>
    </div>
  );

  const sharedClasses = cn(
    // ≥44pt tap target (UI/UX Pro Max §2 touch-target-size). The padding
    // alone gives us ~52pt on mobile.
    'block w-full rounded border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    selected
      ? 'border-primary bg-primary/5'
      : 'border-border hover:bg-muted/40',
  );

  // Wide viewport: button updates ?selected. Narrow viewport: anchor to
  // the full detail page (caller decides which by passing/omitting onSelect).
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(thread.id)}
        aria-pressed={selected}
        className={sharedClasses}
      >
        {body}
      </button>
    );
  }

  return (
    <Link href={`/research/threads/${thread.id}`} className={sharedClasses}>
      {body}
    </Link>
  );
}
