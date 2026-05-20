'use client';

import { Suspense, use, useState } from 'react';
import Link from 'next/link';
import { Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveThread } from '@/lib/research/active-thread';
import { ThreadTimelinePanel } from './thread-timeline-panel';

export type ThreadStatus = 'active' | 'paused' | 'resolved' | 'abandoned';

export interface ThreadDetailData {
  id: string;
  title: string;
  status: ThreadStatus;
  summary: string | null;
  updatedAt: string;
  eventCount?: number;
  seedPersonId?: string | null;
  seedFactsheetId?: string | null;
  seedResearchItemId?: string | null;
}

interface ThreadDetailViewProps {
  threadId: string;
  /** Server-streamed thread row. `null` means not found / no access. */
  threadPromise: Promise<ThreadDetailData | null>;
  /** Server-streamed persons-touched ids. Resolved in parallel. */
  personsPromise: Promise<string[]>;
}

const STATUS_VARIANT: Record<ThreadStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  resolved: 'outline',
  abandoned: 'outline',
};

/**
 * Top-level orchestrator for /research/threads/[id]. Replaces the older
 * `ThreadDetailClient` which used `useEffect + useState` to fetch on
 * mount. Now data streams from the server: the parent RSC creates
 * promises via `'use cache'` loaders and we resolve them with
 * `use(promise)`. The outer page-level <Suspense> shows a fallback
 * until the thread row arrives; the persons section streams in its
 * own boundary so a slow UNION query doesn't block the header.
 */
export function ThreadDetailView({
  threadId,
  threadPromise,
  personsPromise,
}: ThreadDetailViewProps) {
  // Suspends until the loader returns. `null` means we did the uncached
  // existence check upstream and found nothing — render the empty state
  // rather than a perpetual spinner.
  const thread = use(threadPromise);

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

  return (
    <div className="container max-w-5xl space-y-6 py-2">
      <ThreadDetailHeader thread={thread} />
      <ThreadSummarySection threadId={threadId} initialSummary={thread.summary} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Timeline</h2>
          <ThreadTimelinePanel threadId={thread.id} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-medium">Persons touched</h2>
          <Suspense fallback={<PersonsTouchedSkeleton />}>
            <PersonsTouched personsPromise={personsPromise} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

function ThreadDetailHeader({ thread }: { thread: ThreadDetailData }) {
  const { thread: activeThread, setActive } = useActiveThread();
  const isActive = activeThread?.id === thread.id;

  return (
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
  );
}

function ThreadSummarySection({
  threadId,
  initialSummary,
}: {
  threadId: string;
  initialSummary: string | null;
}) {
  const [summaryDraft, setSummaryDraft] = useState(initialSummary ?? '');
  const [savedSummary, setSavedSummary] = useState(initialSummary ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = summaryDraft !== savedSummary;

  const save = async () => {
    setSaving(true);
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
      // The PATCH route calls revalidateTag(`thread:${id}`); the next
      // render of this page pulls the fresh row from the cached loader.
      setSavedSummary(summaryDraft);
    } finally {
      setSaving(false);
    }
  };

  return (
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
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="size-3 animate-spin mr-2" /> : null}
          Save summary
        </Button>
      </div>
    </section>
  );
}

function PersonsTouched({ personsPromise }: { personsPromise: Promise<string[]> }) {
  const personIds = use(personsPromise);

  if (personIds.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        This thread hasn&apos;t touched any tree persons yet.
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {personIds.map(pid => (
        <li key={pid} className="text-xs">
          <Link href={`/persons/${pid}`} className="text-amber-700 hover:underline">
            {pid}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PersonsTouchedSkeleton() {
  return (
    <ul className="space-y-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}><Skeleton className="h-3 w-32" /></li>
      ))}
    </ul>
  );
}
