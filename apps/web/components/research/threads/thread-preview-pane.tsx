'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Notebook } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useActiveThread } from '@/lib/research/active-thread';
import type { ThreadListItem, ThreadStatus } from '@/lib/research/use-thread-list';

interface ThreadEventLite {
  id: string;
  eventType: string;
  reason: string | null;
  occurredAt: string;
  actorId: string;
}

interface ThreadDetail {
  id: string;
  title: string;
  status: ThreadStatus;
  summary: string | null;
  updatedAt: string;
  eventCount?: number;
}

interface ThreadPreviewPaneProps {
  /** When empty, the pane renders a friendly placeholder. */
  threadId: string;
  /**
   * When the parent list already has the thread row in memory, pass it
   * here to skip the GET /threads/:id fetch on selection. The events
   * fetch still runs because the list payload doesn't carry events.
   */
  initialThread?: ThreadListItem | null;
}

const STATUS_VARIANT: Record<ThreadStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  resolved: 'outline',
  abandoned: 'outline',
};

// Lightweight version of ThreadDetailClient: shows the same shape (title,
// status, summary, recent events) but read-only and compact, so a desktop
// user can scan many threads quickly. "Open full" navigates to the full
// detail page where summary editing + note-adding live.
export function ThreadPreviewPane({ threadId, initialThread = null }: ThreadPreviewPaneProps) {
  // If the parent provided the thread row from the list, seed `detail`
  // synchronously so the pane renders immediately without a network
  // roundtrip. We still kick off the full GET when no seed is given
  // (e.g. the URL points at a thread that's not in the current filter).
  const seed: ThreadDetail | null = initialThread
    ? {
        id: initialThread.id,
        title: initialThread.title,
        status: initialThread.status,
        summary: initialThread.summary,
        updatedAt: initialThread.updatedAt,
      }
    : null;

  const [detail, setDetail] = useState<ThreadDetail | null | undefined>(seed ?? undefined);
  const [events, setEvents] = useState<ThreadEventLite[] | null>(null);
  const { thread: activeThread, setActive } = useActiveThread();
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;

    // Re-seed from props when the selection changes so the header renders
    // instantly. If no seed is available we fall back to the spinner state.
    setDetail(seed ?? undefined);
    setEvents(null);

    // Only fetch the full thread if we don't have a seed — the seed is
    // missing the eventCount, but a) eventCount appears in the preview as
    // a "· N events" tagline and b) the list query is the same row source
    // so showing the count is a future enhancement. For now skip the
    // GET entirely when seeded.
    if (!seed) {
      fetch(`/api/research/threads/${threadId}`)
        .then(async r => {
          if (!r.ok) {
            if (!cancelled) setDetail(null);
            return;
          }
          const data = await r.json();
          if (!cancelled) setDetail(data);
        })
        .catch(() => { if (!cancelled) setDetail(null); });
    }

    fetch(`/api/research/threads/${threadId}/events`)
      .then(async r => {
        if (!r.ok) {
          if (!cancelled) setEvents([]);
          return;
        }
        const data = await r.json();
        if (!cancelled) setEvents(Array.isArray(data.events) ? data.events.slice(0, 5) : []);
      })
      .catch(() => { if (!cancelled) setEvents([]); });

    return () => { cancelled = true; };
    // seed is derived from initialThread which is itself a prop the
    // parent recomputes; depending on threadId + initialThread.id is
    // equivalent and avoids referencing the derived `seed` (which would
    // change identity every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, initialThread?.id]);

  if (!threadId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <Notebook className="size-6 text-muted-foreground/40" aria-hidden />
        <div>Select a thread to preview it here.</div>
      </div>
    );
  }

  if (detail === undefined) {
    return (
      <div className="flex h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading preview…
      </div>
    );
  }

  if (detail === null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        Thread not found, or you don&apos;t have access.
      </div>
    );
  }

  const isActive = activeThread?.id === detail.id;

  const handleActivate = async () => {
    setActivating(true);
    try {
      await setActive(detail.id);
      toast.success('Set as active thread');
    } catch {
      toast.error('Failed to set active');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <header className="space-y-2">
        <h2 className="text-base font-semibold leading-tight">{detail.title}</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={STATUS_VARIANT[detail.status]}>{detail.status}</Badge>
          {typeof detail.eventCount === 'number' && (
            <span className="tabular-nums">· {detail.eventCount} events</span>
          )}
          <span title={new Date(detail.updatedAt).toLocaleString()}>
            · updated <span className="tabular-nums">{new Date(detail.updatedAt).toLocaleDateString()}</span>
          </span>
        </div>
      </header>

      {detail.summary ? (
        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</h3>
          <p className="text-sm leading-relaxed">{detail.summary}</p>
        </section>
      ) : (
        <p className="text-xs italic text-muted-foreground">No summary yet. Open the full view to add one.</p>
      )}

      <section className="min-h-0 flex-1">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent timeline</h3>
        {events === null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="text-xs text-muted-foreground">No events yet.</div>
        ) : (
          <ul className="space-y-2 text-xs">
            {events.map(e => (
              <li key={e.id} className="border-l-2 border-border pl-2">
                <div className="font-medium">{e.eventType.replace(/_/g, ' ')}</div>
                {e.reason && <div className="text-muted-foreground break-words">{e.reason}</div>}
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {new Date(e.occurredAt).toLocaleString()}
                  {e.actorId === 'ai' && <span className="ml-1">· AI</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {!isActive && detail.status === 'active' && (
          <Button size="sm" variant="outline" onClick={handleActivate} disabled={activating}>
            {activating && <Loader2 className="size-3 animate-spin mr-1" aria-hidden />}
            Make active
          </Button>
        )}
        <Button size="sm" asChild>
          <Link href={`/research/threads/${detail.id}`}>
            Open full <ExternalLink className="ml-1 size-3" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
