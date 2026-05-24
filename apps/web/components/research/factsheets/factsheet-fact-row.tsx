'use client';

import { useState, useCallback } from 'react';
import { RotateCcw, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CONFIDENCE_VARIANT } from '@/lib/research/constants';
import { Badge } from '@/components/ui/badge';
import { ReverseActionDialog } from '@/components/inbox/reverse-action-dialog';
import type { FactsheetFact } from '@/lib/research/factsheet-client';
import { MentionCascadeChip } from '../threads/mention-cascade-chip';

interface FactsheetFactRowProps {
  fact: FactsheetFact;
  factsheetId: string;
  isConflict: boolean;
  sourceTitle?: string;
  onAccept?: () => void;
  onReject?: () => void;
  isResolving?: boolean;
  onChanged?: () => void;
}

export function FactsheetFactRow({
  fact, factsheetId, isConflict, sourceTitle, onAccept, onReject, isResolving, onChanged,
}: FactsheetFactRowProps) {
  const isAccepted = fact.accepted === true;
  const isRejected = fact.accepted === false;
  const isResolved = isAccepted || isRejected;
  const isContested = fact.contested === true;
  const canDispute = !isContested && fact.confidence !== 'unknown';
  const confVariant = CONFIDENCE_VARIANT[fact.confidence] ?? 'secondary';

  const [resetOpen, setResetOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const handleReset = useCallback(async (reason: string) => {
    const res = await fetch(`/api/research/facts/${fact.id}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; message?: string }));
      if (body.error === 'parent-factsheet-promoted') {
        toast.error(body.message ?? 'Unmerge the factsheet first.');
        return;
      }
      throw new Error(body.message || body.error || 'Reset failed');
    }
    toast.success('Fact reset');
    onChanged?.();
  }, [fact.id, onChanged]);

  const handleDispute = useCallback(async (reason: string) => {
    const res = await fetch(`/api/research/facts/${fact.id}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: string; message?: string }));
      throw new Error(body.message || body.error || 'Dispute failed');
    }
    toast.success('Fact marked as contested');
    onChanged?.();
  }, [fact.id, onChanged]);

  return (
    <div
      className={cn(
        'rounded-md px-3 py-2 border',
        isConflict && !isAccepted && !isRejected && 'border-destructive/40 bg-destructive/5',
        isAccepted && 'border-l-[3px] border-l-green-500 border-t-border border-r-border border-b-border bg-muted/30',
        isRejected && 'opacity-50 border-border bg-muted/20',
        !isConflict && !isAccepted && !isRejected && 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {fact.factType.replace(/_/g, ' ')}
          </span>
          <span className={cn('ml-2 text-sm', isRejected && 'line-through')}>
            {fact.factValue}
          </span>
          {isAccepted && <span className="ml-2 text-[10px] text-green-500">✓ accepted</span>}
          {isConflict && !isAccepted && !isRejected && (
            <span className="ml-2 text-[10px] text-destructive">⚠ conflict</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isConflict && !isAccepted && !isRejected && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-green-500 hover:text-green-400"
                onClick={onAccept}
                disabled={isResolving}
              >
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-destructive hover:text-destructive/80"
                onClick={onReject}
                disabled={isResolving}
              >
                Reject
              </Button>
            </>
          )}
          {isResolved && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setResetOpen(true)}
              title="Reset to unresolved"
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
          {canDispute && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-amber-500 hover:text-amber-400"
              onClick={() => setDisputeOpen(true)}
              title="Dispute this fact"
            >
              <Flag className="size-3" />
            </Button>
          )}
          {isContested && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
              contested
            </Badge>
          )}
          <Badge variant={confVariant} className="text-[9px] h-4 px-1.5">
            {fact.confidence}
          </Badge>
        </div>
      </div>

      {sourceTitle && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          From: {sourceTitle}
        </p>
      )}

      {(fact.factType === 'spouse_name' || fact.factType === 'child_name') && fact.factValue && (
        <div className="mt-1">
          <MentionCascadeChip
            sourceFactsheetId={factsheetId}
            sourceFactId={fact.id}
            mentionedName={fact.factValue}
            relationshipLabel={fact.factType === 'spouse_name' ? 'spouse' : 'child'}
            relationshipType={fact.factType === 'spouse_name' ? 'spouse' : 'parent_child'}
            sourceTitle={sourceTitle ?? 'this fact'}
            fromAI={fact.extractionMethod === 'ai_extracted'}
          />
        </div>
      )}
      {/* TODO Phase 2.5: parent_name needs inverted direction in cascade — defer */}

      <ReverseActionDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset fact"
        description={`Return this ${isAccepted ? 'accepted' : 'rejected'} fact to unresolved.`}
        actionLabel="Reset"
        onConfirm={handleReset}
      />
      <ReverseActionDialog
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        title="Dispute fact"
        description="Mark this fact as contested. It stays in the timeline but is flagged as disputed."
        actionLabel="Dispute"
        onConfirm={handleDispute}
      />
    </div>
  );
}
