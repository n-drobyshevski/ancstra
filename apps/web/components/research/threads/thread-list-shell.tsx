'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState, useTransition } from 'react';
import { useQueryStates } from 'nuqs';
import { Search, Notebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useActiveThread } from '@/lib/research/active-thread';
import {
  threadsParsers,
  THREAD_STATUS_FILTER,
  THREAD_SORT_KEYS,
  type ThreadStatusFilter,
  type ThreadSortKey,
} from '@/lib/research/threads-search-params';
import { applyThreadSort } from '@/lib/research/thread-list-utils';
import type { ThreadListItem } from '@/lib/research/use-thread-list';
import { ThreadListRow } from './thread-list-row';
import { ThreadPreviewPane } from './thread-preview-pane';

const STATUS_CHIP_LABEL: Record<ThreadStatusFilter, string> = {
  all: 'All',
  active: 'Active',
  paused: 'Paused',
  resolved: 'Resolved',
  abandoned: 'Abandoned',
};

const SORT_LABEL: Record<ThreadSortKey, string> = {
  updated: 'Last touched',
  created: 'Created',
  title: 'Title',
};

function useLg(): boolean {
  // Tailwind's `lg` breakpoint is 1024px. Resolve client-side so the
  // shell can swap between split-pane (lg+) and list-only behaviour
  // without parallel routes.
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLg(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return isLg;
}

interface ThreadListShellProps {
  /**
   * Cached thread list promise streamed from the server data shell.
   * Resolved with React 19's `use()` so the surrounding <Suspense>
   * boundary owns the loading state — keeps the client small and
   * lets the Next.js Data Cache absorb repeat navigations.
   */
  threadsPromise: Promise<ThreadListItem[]>;
}

export function ThreadListShell({ threadsPromise }: ThreadListShellProps) {
  // Suspends until the server-streamed promise resolves; the outer
  // <Suspense fallback={<ThreadListSkeleton/>}> covers this.
  const threads = use(threadsPromise);

  const [isPending, startTransition] = useTransition();
  const [params, setParams] = useQueryStates(threadsParsers, {
    shallow: false,
    history: 'push',
    startTransition,
  });
  const isLg = useLg();
  const { thread: activeThread } = useActiveThread();

  // Debounced commit so typing feels instant but URL/server fetch only
  // fires after 300ms of stillness — keeps us from spamming the data
  // cache on every keystroke.
  const handleSearchCommit = (value: string) => {
    if (value === params.q) return;
    void setParams({ q: value });
  };

  // Server already applied the q + status filters. Sort is client-side
  // because changing it shouldn't trigger a refetch.
  const visible = useMemo(() => applyThreadSort(threads, params.sort), [threads, params.sort]);

  // If the URL points at a thread that isn't in the current filter, drop
  // it silently so the preview pane shows the placeholder.
  const selectedId = visible.some(t => t.id === params.selected) ? params.selected : '';
  const selectedThread = selectedId ? visible.find(t => t.id === selectedId) ?? null : null;

  const handleSelect = (id: string) => {
    void setParams({ selected: id });
  };

  const handleStatusClick = (next: ThreadStatusFilter) => {
    void setParams({ status: next, selected: '' });
  };

  const handleSortClick = (next: ThreadSortKey) => {
    void setParams({ sort: next });
  };

  const total = threads.length;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold leading-tight">Research Threads</h1>
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? 'No threads in this family yet.'
              : `${total} thread${total === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Keying on params.q resets the local input when the URL
              changes externally (back/forward nav, deep link) without
              needing a syncing useEffect. */}
          <DebouncedSearchInput
            key={params.q}
            initialValue={params.q}
            onCommit={handleSearchCommit}
          />
        </div>
      </div>

      {/* Status chips + sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {THREAD_STATUS_FILTER.map(s => {
            const active = params.status === s;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleStatusClick(s)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
              >
                {STATUS_CHIP_LABEL[s]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Sort:</span>
          {THREAD_SORT_KEYS.map(k => {
            const active = params.sort === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => handleSortClick(k)}
                className={cn(
                  'rounded px-2 py-0.5 transition-colors',
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'hover:bg-muted/60',
                )}
                aria-pressed={active}
              >
                {SORT_LABEL[k]}
              </button>
            );
          })}
        </div>
      </div>

      {/* List + preview */}
      <div className={cn(
        'min-h-0 flex-1 overflow-hidden rounded-lg border border-border',
        isPending && 'opacity-80',
      )}>
        <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* List */}
          <div className="overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <Notebook className="size-8 text-muted-foreground/40" aria-hidden />
                <div className="space-y-1">
                  <p className="text-sm font-medium">No threads {params.status !== 'all' ? `(${STATUS_CHIP_LABEL[params.status].toLowerCase()})` : 'yet'}.</p>
                  <p className="text-xs text-muted-foreground">
                    Right-click a person on the canvas, or open Research and start a new investigation.
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href="/research">Start a thread</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-1.5 p-2">
                {visible.map(t => (
                  <li key={t.id}>
                    <ThreadListRow
                      thread={t}
                      selected={isLg && t.id === selectedId}
                      onSelect={isLg ? handleSelect : undefined}
                      isActive={activeThread?.id === t.id}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Preview — lg+ only. Below lg, row clicks navigate to the
              full detail page so we never show this column. */}
          <div className="hidden border-l border-border lg:block">
            <ThreadPreviewPane threadId={selectedId} initialThread={selectedThread} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Search input that owns its own local value and emits the value to
 * `onCommit` after 300ms of stillness. Mounted with `key={url-value}`
 * by the parent so back/forward navigation resets it cleanly without
 * a bidirectional sync effect.
 */
function DebouncedSearchInput({
  initialValue,
  onCommit,
  delayMs = 300,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  delayMs?: number;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (value === initialValue) return;
    const timer = setTimeout(() => onCommit(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, initialValue, onCommit, delayMs]);

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        inputMode="search"
        placeholder="Search threads…"
        aria-label="Search threads"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-56 pl-7 text-sm"
      />
    </div>
  );
}
