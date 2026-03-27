'use client';

import { cn } from '@/lib/utils';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import type { Factsheet } from '@/lib/research/factsheet-client';

interface FactsheetCardProps {
  factsheet: Factsheet;
  isSelected: boolean;
  factCount: number;
  linkCount: number;
  conflictCount: number;
  onClick: () => void;
}

export function FactsheetCard({
  factsheet, isSelected, factCount, linkCount, conflictCount, onClick,
}: FactsheetCardProps) {
  const status = FACTSHEET_STATUS_CONFIG[factsheet.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const isDismissed = factsheet.status === 'dismissed';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
        'hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'border-primary bg-accent/5' : 'border-border',
        isDismissed && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-medium leading-snug line-clamp-1">{factsheet.title}</p>
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', status.className)}>
          {status.label}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {factCount} fact{factCount !== 1 ? 's' : ''}
        {linkCount > 0 && ` · ${linkCount} link${linkCount !== 1 ? 's' : ''}`}
        {conflictCount > 0 && (
          <span className="text-destructive"> · {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}</span>
        )}
      </p>
    </button>
  );
}
