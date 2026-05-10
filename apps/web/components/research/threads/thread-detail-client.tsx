'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useActiveThread } from '@/lib/research/active-thread';
import { ThreadTimelinePanel } from './thread-timeline-panel';

interface Thread {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'resolved' | 'abandoned';
  summary: string | null;
  updatedAt: string;
  eventCount?: number;
  seedPersonId?: string | null;
  seedFactsheetId?: string | null;
  seedResearchItemId?: string | null;
}

interface ThreadTouch {
  id: string;
  title: string;
  status: string;
  lastTouchedAt: string;
}

interface ThreadDetailClientProps {
  threadId: string;
}

const STATUS_VARIANT: Record<Thread['status'], 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  resolved: 'outline',
  abandoned: 'outline',
};

/**
 * Full-page thread "deep dive" view. Reads thread + related collections
 * via the JSON APIs (server-side family-DB resolution would require its
 * own helper under cacheComponents — fetch is simpler and stays in one
 * client component). Lifecycle controls live on the header bar (the
 * sticky bar pattern shipped in Phase 2), not here, so this page has no
 * pause/resolve/abandon buttons by design (locked decision 6).
 */
export function ThreadDetailClient({ threadId }: ThreadDetailClientProps) {
  const [thread, setThread] = useState<Thread | null | undefined>(undefined); // undefined = loading
  const [summaryDraft, setSummaryDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);
  const [touchedPersonIds, setTouchedPersonIds] = useState<string[] | null>(null);
  const { thread: activeThread, setActive } = useActiveThread();

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/threads/${threadId}`);
      if (!res.ok) {
        setThread(null);
        return;
      }
      const data = await res.json();
      setThread(data);
      setSummaryDraft(data.summary ?? '');
    } catch (err) {
      console.error(err);
      setThread(null);
    }
  }, [threadId]);

  useEffect(() => {
    loadThread();
    fetch(`/api/research/threads/${threadId}/persons`)
      .then(r => r.json())
      .then(b => setTouchedPersonIds(b.personIds ?? []))
      .catch(() => setTouchedPersonIds([]));
  }, [threadId, loadThread]);

  const saveSummary = async () => {
    setSavingSummary(true);
    try {
      const res = await fetch(`/api/research/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summaryDraft }),
      });
      if (!res.ok) {
        toast.error('Failed to save summary');
        return;
      }
      toast.success('Summary saved');
      await loadThread();
    } finally {
      setSavingSummary(false);
    }
  };

  if (thread === undefined) {
    return (
      <div className="py-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading thread…
      </div>
    );
  }

  if (thread === null) {
    return (
      <div className="py-8 text-sm text-muted-foreground">
        Thread not found, or you don&apos;t have access.
        <div className="mt-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/research"><ChevronLeft className="size-3 mr-1" /> Back to Research</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isActive = activeThread?.id === thread.id;
  const summaryChanged = (thread.summary ?? '') !== summaryDraft;

  return (
    <div className="container max-w-5xl space-y-6 py-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/research"><ChevronLeft className="size-3 mr-1" /> Research</Link>
          </Button>
          <h1 className="text-2xl font-semibold leading-tight">{thread.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={STATUS_VARIANT[thread.status]}>{thread.status}</Badge>
            <span>· updated {new Date(thread.updatedAt).toLocaleString()}</span>
            {typeof thread.eventCount === 'number' && (
              <span>· {thread.eventCount} events</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isActive && thread.status === 'active' ? (
            <Button
              size="sm"
              onClick={async () => {
                try { await setActive(thread.id); toast.success('Set as active thread'); }
                catch { toast.error('Failed to set active'); }
              }}
            >
              Set as active
            </Button>
          ) : isActive ? (
            <Badge variant="outline" className="border-amber-400/70 text-amber-700">
              Currently active
            </Badge>
          ) : null}
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Summary</h2>
        <Textarea
          value={summaryDraft}
          onChange={(e) => setSummaryDraft(e.target.value)}
          placeholder="Write a short summary of this investigation. The AI's summarizeThread tool can draft one for you."
          rows={4}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={saveSummary}
            disabled={!summaryChanged || savingSummary}
          >
            {savingSummary ? <Loader2 className="size-3 animate-spin mr-2" /> : null}
            Save summary
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Timeline</h2>
          <ThreadTimelinePanel threadId={thread.id} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Persons touched</h2>
          {touchedPersonIds === null ? (
            <div className="text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin inline mr-2" /> Loading…
            </div>
          ) : touchedPersonIds.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              This thread hasn&apos;t touched any tree persons yet.
            </div>
          ) : (
            <ul className="space-y-1">
              {touchedPersonIds.map(pid => (
                <li key={pid} className="text-xs">
                  <Link href={`/persons/${pid}`} className="text-amber-700 hover:underline">
                    {pid}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
