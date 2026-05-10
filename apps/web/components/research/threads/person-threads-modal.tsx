'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useActiveThread } from '@/lib/research/active-thread';

interface ThreadTouch {
  id: string;
  title: string;
  status: string;
  lastTouchedAt: string;
}

interface PersonThreadsModalProps {
  /** When set + open, fetches threads for this person. */
  personId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Modal triggered by the tree context-menu "Show threads that touched this
 * person" item. Lists all research threads that have referenced the given
 * person (via promoted factsheet or thread event), with a one-click
 * "Set active" action that activates the thread for the current family.
 */
export function PersonThreadsModal({ personId, open, onOpenChange }: PersonThreadsModalProps) {
  const [threads, setThreads] = useState<ThreadTouch[] | null>(null);
  const { setActive } = useActiveThread();

  useEffect(() => {
    if (!open || !personId) return;
    setThreads(null);
    fetch(`/api/persons/${personId}/threads`)
      .then(r => r.json())
      .then(b => setThreads(b.threads ?? []))
      .catch(() => setThreads([]));
  }, [open, personId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Threads that touched this person</DialogTitle>
          <DialogDescription>
            Research threads that referenced this person via a promoted factsheet or a thread event.
          </DialogDescription>
        </DialogHeader>
        {threads === null ? (
          <div className="py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-2" /> Loading...
          </div>
        ) : threads.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">
            No threads have touched this person yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {threads.map(t => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.status} · last touched {new Date(t.lastTouchedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-amber-700 hover:underline"
                  onClick={async () => {
                    try {
                      await setActive(t.id);
                      onOpenChange(false);
                    } catch (err) {
                      console.error('Failed to set active thread:', err);
                    }
                  }}
                >
                  Set active
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
