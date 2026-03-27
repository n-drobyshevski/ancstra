'use client';

import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const EVENT_DOT_COLORS: Record<string, string> = {
  birth: 'border-green-500 bg-green-500/20',
  death: 'border-gray-400 bg-gray-400/20',
  marriage: 'border-pink-500 bg-pink-500/20',
  divorce: 'border-orange-400 bg-orange-400/20',
  census: 'border-blue-400 bg-blue-400/20',
  immigration: 'border-cyan-500 bg-cyan-500/20',
  emigration: 'border-teal-500 bg-teal-500/20',
  residence: 'border-violet-400 bg-violet-400/20',
  burial: 'border-stone-400 bg-stone-400/20',
  christening: 'border-amber-400 bg-amber-400/20',
  baptism: 'border-amber-400 bg-amber-400/20',
};

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
  /** 'event' = person event (blue border), 'fact' = research fact (neutral border) */
  entrySource?: 'event' | 'fact';
  /** If true, show edit/delete action buttons */
  editable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TimelineEvent({
  date,
  factType,
  factValue,
  confidence,
  sourceName,
  hasConflict,
  isLast,
  entrySource = 'fact',
  editable,
  onEdit,
  onDelete,
}: TimelineEventProps) {
  const conf = CONFIDENCE_BADGE[confidence] ?? CONFIDENCE_BADGE.medium;
  const isEvent = entrySource === 'event';

  return (
    <div className="group relative flex gap-4 pb-6 last:pb-0 -mx-2 px-2 rounded-lg transition-colors duration-150 hover:bg-muted/30">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'relative z-10 mt-1 size-3 shrink-0 rounded-full border-2',
            hasConflict
              ? 'border-destructive bg-destructive/20'
              : EVENT_DOT_COLORS[factType.toLowerCase()] ?? (isEvent ? 'border-blue-500 bg-blue-500/20' : 'border-primary bg-primary/20'),
          )}
        >
          {hasConflict && (
            <AlertTriangle className="absolute -right-1.5 -top-1.5 size-3 text-destructive" />
          )}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border/70" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5 pb-2">
        {date && (
          <p className="text-xs font-medium text-muted-foreground">{date}</p>
        )}
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold capitalize">{factType}</p>
          {editable && (
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="ghost" size="icon" className="size-6" onClick={onEdit}>
                <Pencil className="size-3" />
              </Button>
              <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={onDelete}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}
        </div>
        <p className="text-sm text-foreground/80">{factValue}</p>
        <div className="flex items-center gap-2 pt-0.5">
          {sourceName && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {sourceName}
            </span>
          )}
          {isEvent && (
            <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600">
              Event
            </Badge>
          )}
          <Badge variant={conf.variant} className="text-[10px]">
            {conf.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
