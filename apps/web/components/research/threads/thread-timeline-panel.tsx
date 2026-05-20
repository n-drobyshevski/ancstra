'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ThreadEvent {
  id: string;
  threadId: string;
  eventType: string;
  actorId: string;
  reason: string | null;
  occurredAt: string;
  factsheetId: string | null;
  personId: string | null;
  researchItemId: string | null;
  researchFactId: string | null;
  sourceId: string | null;
  linkId: string | null;
}

interface ThreadTimelinePanelProps {
  threadId: string;
}

const EVENT_LABEL: Record<string, string> = {
  thread_started: 'Thread started',
  item_attached: 'Attached research item',
  fact_extracted: 'Extracted fact',
  factsheet_created: 'Created factsheet',
  factsheet_linked: 'Linked factsheets',
  mention_followed: 'Followed mention',
  conflict_resolved: 'Resolved conflict',
  duplicate_resolved: 'Resolved duplicate',
  factsheet_promoted: 'Promoted to person',
  note_added: 'Note',
  thread_paused: 'Paused',
  thread_resolved: 'Resolved',
  thread_abandoned: 'Abandoned',
};

const EVENT_ICON: Record<string, string> = {
  thread_started: '·',
  item_attached: '📄',
  fact_extracted: '·',
  factsheet_created: '📝',
  factsheet_linked: '🔗',
  mention_followed: '➡',
  conflict_resolved: '✅',
  duplicate_resolved: '🔀',
  factsheet_promoted: '🌱',
  note_added: '✎',
  thread_paused: '⏸',
  thread_resolved: '🏁',
  thread_abandoned: '🗑',
};

/**
 * Latest-first paginated timeline. Initial page (50 events) loads on
 * mount; older pages append via the "Load older events" button using
 * the opaque `nextCursor` from the server. Adding a new note prepends
 * to the top and is rendered immediately without a full refetch.
 */
export function ThreadTimelinePanel({ threadId }: ThreadTimelinePanelProps) {
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);

  // Load the first page (latest events). Replaces `events` rather than
  // appending so refresh-after-mutation always returns to a clean state.
  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/research/threads/${threadId}/events?limit=50`);
      if (!res.ok) {
        toast.error('Failed to load timeline');
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  // Append the next page (events older than the last visible row).
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = `/api/research/threads/${threadId}/events?limit=50&cursor=${encodeURIComponent(nextCursor)}`;
      const res = await fetch(url);
      if (!res.ok) {
        toast.error('Failed to load older events');
        return;
      }
      const data = await res.json();
      setEvents(prev => [...prev, ...(data.events ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }, [threadId, nextCursor, loadingMore]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const addNote = async () => {
    if (!note.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/research/threads/${threadId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) {
        toast.error('Failed to add note', { description: await res.text() });
        return;
      }
      const created: ThreadEvent = await res.json();
      // Optimistic prepend: the new event is always the latest, so it
      // belongs at the top in our DESC ordering. Avoids a full refetch
      // that would otherwise wipe any "Load older" pages.
      setEvents(prev => [created, ...prev]);
      setNote('');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin inline mr-2" />
        Loading timeline...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <ul className="flex-1 space-y-2 overflow-y-auto text-sm">
        {events.length === 0 ? (
          <li className="text-xs text-muted-foreground py-4 text-center">No events yet.</li>
        ) : (
          events.map(e => (
            <li key={e.id} className="flex gap-2">
              <span className="text-muted-foreground shrink-0">{EVENT_ICON[e.eventType] ?? '·'}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{EVENT_LABEL[e.eventType] ?? e.eventType}</div>
                {e.reason && <div className="text-muted-foreground text-xs break-words">{e.reason}</div>}
                <div className="text-muted-foreground text-[10px]">
                  {new Date(e.occurredAt).toLocaleString()}
                  {e.actorId === 'ai' && <span className="ml-1">· AI</span>}
                </div>
              </div>
            </li>
          ))
        )}
        {nextCursor && (
          <li className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full text-xs text-muted-foreground"
            >
              {loadingMore ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
              {loadingMore ? 'Loading…' : 'Load older events'}
            </Button>
          </li>
        )}
      </ul>
      <div className="border-t pt-3">
        <Textarea
          rows={2}
          placeholder="What did you find?"
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
        />
        <Button onClick={addNote} disabled={!note.trim() || posting} size="sm" className="mt-2">
          {posting ? <Loader2 className="size-4 animate-spin" /> : 'Add note'}
        </Button>
      </div>
    </div>
  );
}
