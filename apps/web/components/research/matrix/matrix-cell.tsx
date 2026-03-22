'use client';

import { cn } from '@/lib/utils';
import type { MatrixCell } from '@/lib/research/matrix-helpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const CONFIDENCE_BG: Record<string, string> = {
  high: 'bg-green-50 dark:bg-green-950/30',
  medium: 'bg-amber-50 dark:bg-amber-950/30',
  low: 'bg-red-50 dark:bg-red-950/30',
  disputed: 'bg-red-100 dark:bg-red-950/50',
};

const CONFIDENCE_TEXT: Record<string, string> = {
  high: 'text-green-700 dark:text-green-400',
  medium: 'text-yellow-700 dark:text-yellow-400',
  low: 'text-red-700 dark:text-red-400',
  disputed: 'text-red-800 dark:text-red-300',
};

interface MatrixCellComponentProps {
  cell: MatrixCell | undefined;
  isConflict?: boolean;
  onCellClick: (factId: string) => void;
}

export function MatrixCellComponent({
  cell,
  isConflict,
  onCellClick,
}: MatrixCellComponentProps) {
  if (!cell) {
    return (
      <td className="px-3 py-2 min-w-[140px] text-center">
        <span className="text-xs text-muted-foreground/40">&mdash;</span>
      </td>
    );
  }

  return (
    <td
      className={cn(
        'px-3 py-2 min-w-[140px] cursor-pointer transition-colors hover:bg-accent/50',
        CONFIDENCE_BG[cell.confidence],
        isConflict && 'border-l-2 border-red-400',
      )}
      onClick={() => onCellClick(cell.factId)}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'text-sm truncate block max-w-[180px]',
                CONFIDENCE_TEXT[cell.confidence],
              )}
            >
              {cell.value}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{cell.value}</p>
              <p className="text-muted-foreground">
                Confidence: {cell.confidence}
              </p>
              <p className="text-muted-foreground">
                Source: {cell.sourceTitle}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </td>
  );
}
