'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useActiveThread } from '@/lib/research/active-thread';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { cn } from '@/lib/utils';

interface ThreadListItem {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'resolved' | 'abandoned';
  updatedAt: string;
}

/**
 * Compact list of all research threads for use in the tree right-sidebar's
 * "Threads" tab. Click a row to set that thread active. The currently active
 * thread (per the active-thread cookie) gets a subtle highlight.
 */
export function ThreadsSidebarPanel() {
  const isHydrated = useIsHydrated();
  const { thread: activeThread, setActive } = useActiveThread();
  const [threads, setThreads] = useState<ThreadListItem[] | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;
    fetch('/api/research/threads')
      .then(r => r.json())
      .then(b => {
        if (!cancelled) setThreads(b.threads ?? []);
      })
      .catch(() => { if (!cancelled) setThreads([]); });
    return () => { cancelled = true; };
  }, [isHydrated]);

  if (threads === null) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin inline mr-2" />
        Loading…
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground">
        No research threads yet. Right-click a person on the canvas to start one.
      </div>
    );
  }

  return (
    <ul className="px-2 py-2 space-y-1">
      {threads.map(t => {
        const isActive = activeThread?.id === t.id;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={async () => {
                try { await setActive(t.id); } catch (err) { console.error(err); }
              }}
              className={cn(
                'w-full text-left rounded border px-2 py-1.5 text-xs transition-colors',
                isActive
                  ? 'border-amber-400/70 bg-amber-50/40 dark:bg-amber-900/20'
                  : 'hover:bg-muted/50',
              )}
            >
              <div className="font-medium truncate">{t.title}</div>
              <div className="text-[10px] text-muted-foreground">
                {t.status} · {new Date(t.updatedAt).toLocaleDateString()}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
