'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CONFIDENCE_VARIANT } from '@/lib/research/constants';
import { Badge } from '@/components/ui/badge';
import type { FactsheetFact } from '@/lib/research/factsheet-client';

interface FactsheetFactRowProps {
  fact: FactsheetFact;
  isConflict: boolean;
  sourceTitle?: string;
  onAccept?: () => void;
  onReject?: () => void;
  isResolving?: boolean;
}

export function FactsheetFactRow({
  fact, isConflict, sourceTitle, onAccept, onReject, isResolving,
}: FactsheetFactRowProps) {
  const isAccepted = fact.accepted === true;
  const isRejected = fact.accepted === false;
  const confVariant = CONFIDENCE_VARIANT[fact.confidence] ?? 'secondary';

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
    </div>
  );
}
