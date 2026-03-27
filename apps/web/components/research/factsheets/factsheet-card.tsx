'use client';

import { useRef, useCallback } from 'react';
import { Check } from 'lucide-react';
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
  isUnanchored?: boolean;
  isSelectable?: boolean;
  isChecked?: boolean;
  onCheckChange?: (checked: boolean) => void;
  onLongPress?: () => void;
}

export function FactsheetCard({
  factsheet, isSelected, factCount, linkCount, conflictCount, onClick,
  isUnanchored, isSelectable, isChecked, onCheckChange, onLongPress,
}: FactsheetCardProps) {
  const status = FACTSHEET_STATUS_CONFIG[factsheet.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const isDismissed = factsheet.status === 'dismissed';

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return;
    longPressTimer.current = setTimeout(() => {
      onLongPress();
      longPressTimer.current = null;
    }, 500);
  }, [onLongPress]);

  const handlePointerUpOrLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrLeave}
      onPointerLeave={handlePointerUpOrLeave}
      onPointerCancel={handlePointerUpOrLeave}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer',
        'hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'border-primary bg-accent/5' : 'border-border',
        isDismissed && 'opacity-50',
        isUnanchored && 'border-l-[3px] border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        {isSelectable && (
          <div
            role="checkbox"
            tabIndex={0}
            aria-checked={isChecked}
            onClick={(e) => {
              e.stopPropagation();
              onCheckChange?.(!isChecked);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onCheckChange?.(!isChecked); } }}
            className={cn(
              'size-4 shrink-0 rounded border border-border flex items-center justify-center cursor-pointer',
              isChecked && 'bg-primary border-primary'
            )}
          >
            {isChecked && <Check className="size-3 text-primary-foreground" />}
          </div>
        )}
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
        {isUnanchored && (
          <span className="text-amber-600 dark:text-amber-400 text-[10px]"> ⚠ unanchored</span>
        )}
      </p>
    </div>
  );
}
