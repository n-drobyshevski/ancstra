'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PatchDiffView } from './patch-diff-view';
import type { PatchDiff } from '@ancstra/research';

/**
 * Bundle C 2026-05-24 — modal shown when promote returns 409 PersonDirty.
 * Lets the user choose to detach (preserve manual edits) or force-repromote
 * (discard manual edits).
 *
 * Bundle D 2026-05-25 — detach path now handles 422 ClusterDetachNotSupported:
 * renders an inline error banner with a link to open the cluster unmerge dialog.
 *
 * See: docs/superpowers/specs/2026-05-24-research-flow-unification-bundle-c-design.md §6
 * See: docs/superpowers/specs/2026-05-25-research-flow-unification-bundle-d-design.md §6.4
 */

export interface RepromoteDirtyModalProps {
  open: boolean;
  factsheetId: string;
  diff: PatchDiff;
  diffHash: string;
  onClose: () => void;
  onSuccess: (mode: 'force-repromoted' | 'detached', payload: unknown) => void;
  /**
   * Bundle D 2026-05-25: called when the user clicks the cluster-unmerge link
   * in the ClusterDetachNotSupported error banner. Caller (factsheet-detail)
   * wires this to open the cluster unmerge dialog.
   */
  onRequestClusterUnmerge?: () => void;
}

export function RepromoteDirtyModal({
  open,
  factsheetId,
  diff: initialDiff,
  diffHash: initialHash,
  onClose,
  onSuccess,
  onRequestClusterUnmerge,
}: RepromoteDirtyModalProps) {
  const t = useTranslations('factsheet');
  const [reason, setReason] = useState('');
  const [diff, setDiff] = useState<PatchDiff>(initialDiff);
  const [diffHash, setDiffHash] = useState(initialHash);
  const [staleWarning, setStaleWarning] = useState(false);
  const [detachError, setDetachError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reasonValid = reason.trim().length > 0;

  async function handleForce() {
    if (!reasonValid || busy) return;
    setBusy(true);
    setStaleWarning(false);
    try {
      const res = await fetch(`/api/research/factsheets/${factsheetId}/repromote-force`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), diffHash }),
      });
      if (res.status === 409) {
        const body = await res.json() as { error: string; currentDiff: PatchDiff; currentDiffHash: string };
        if (body.error === 'StaleDiff') {
          setDiff(body.currentDiff);
          setDiffHash(body.currentDiffHash);
          setStaleWarning(true);
          return;
        }
      }
      if (!res.ok) throw new Error(`force-repromote failed: ${res.status}`);
      const body = await res.json() as unknown;
      onSuccess('force-repromoted', body);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleDetach() {
    if (!reasonValid || busy) return;
    setBusy(true);
    setDetachError(null);
    try {
      const res = await fetch(`/api/research/factsheets/${factsheetId}/detach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.status === 422) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        if (body.error === 'ClusterDetachNotSupported') {
          setDetachError(t('errors.clusterDetachNotSupported'));
          return;
        }
      }
      if (!res.ok) throw new Error(`detach failed: ${res.status}`);
      const body = await res.json() as unknown;
      onSuccess('detached', body);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Your version differs from the factsheet</DialogTitle>
        </DialogHeader>

        {staleWarning ? (
          <div
            role="status"
            className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900"
          >
            The person was edited again while you were reviewing. Updated diff shown.
          </div>
        ) : null}

        {detachError ? (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive"
          >
            {detachError}
            {onRequestClusterUnmerge && (
              <>
                {' '}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => { onClose(); onRequestClusterUnmerge(); }}
                >
                  {t('actions.unmergeCluster')}
                </button>
              </>
            )}
          </div>
        ) : null}

        <PatchDiffView diff={diff} />

        <div className="space-y-2">
          <label htmlFor="rdm-reason" className="text-sm font-medium text-slate-700">
            Reason (required)
          </label>
          <Textarea
            id="rdm-reason"
            placeholder="Why are you choosing this action?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleDetach}
            disabled={!reasonValid || busy}
          >
            Detach live link, keep edits
          </Button>
          <Button
            variant="destructive"
            onClick={handleForce}
            disabled={!reasonValid || busy}
          >
            Discard manual edits &amp; re-promote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
