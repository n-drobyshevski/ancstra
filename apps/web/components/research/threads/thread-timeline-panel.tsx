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

export function ThreadTimelinePanel({ threadId }: ThreadTimelinePanelProps) {
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/threads/${threadId}/events`);
      if (!res.ok) {
        toast.error('Failed to load timeline');
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      setNote('');
      await refresh();
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
