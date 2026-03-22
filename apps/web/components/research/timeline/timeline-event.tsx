'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const CONFIDENCE_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  high: { label: 'High', variant: 'default' },
  medium: { label: 'Medium', variant: 'secondary' },
  low: { label: 'Low', variant: 'destructive' },
};

interface TimelineEventProps {
  date: string | null;
  factType: string;
  factValue: string;
  confidence: string;
  sourceName?: string;
  hasConflict?: boolean;
  isLast?: boolean;
}

export function TimelineEvent({
  date,
  factType,
  factValue,
  confidence,
  sourceName,
  hasConflict,
  isLast,
}: TimelineEventProps) {
  const conf = CONFIDENCE_BADGE[confidence] ?? CONFIDENCE_BADGE.medium;

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'relative z-10 mt-1 size-3 shrink-0 rounded-full border-2',
            hasConflict
              ? 'border-destructive bg-destructive/20'
              : 'border-primary bg-primary/20',
          )}
        >
          {hasConflict && (
            <AlertTriangle className="absolute -right-1.5 -top-1.5 size-3 text-destructive" />
          )}
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-border" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5 pb-2">
        {date && (
          <p className="text-xs font-medium text-muted-foreground">{date}</p>
        )}
        <p className="text-sm font-medium">{factType}</p>
        <p className="text-sm text-foreground/80">{factValue}</p>
        <div className="flex items-center gap-2 pt-0.5">
          {sourceName && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {sourceName}
            </span>
          )}
          <Badge variant={conf.variant} className="text-[10px]">
            {conf.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
