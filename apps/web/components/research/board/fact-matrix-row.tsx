'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableRow, TableCell } from '@/components/ui/table';

export interface MatrixCell {
  factId: string | null;
  value: string;
  confidence: string;
  hasConflict: boolean;
}

interface FactMatrixRowProps {
  factType: string;
  cells: (MatrixCell | null)[];
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-status-success-text',
  medium: 'text-status-warning-text',
  low: 'text-status-error-text',
};

export function FactMatrixRow({ factType, cells }: FactMatrixRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[140px]">
        {factType}
      </TableCell>
      {cells.map((cell, i) => (
        <TableCell
          key={i}
          className={cn(
            'min-w-[140px]',
            cell?.hasConflict && 'ring-1 ring-inset ring-destructive/50 bg-destructive/5',
          )}
        >
          {cell ? (
            <div className="flex items-center gap-1.5">
              {cell.hasConflict && (
                <AlertTriangle className="size-3 shrink-0 text-destructive" />
              )}
              <span className={cn('text-sm', CONFIDENCE_COLORS[cell.confidence])}>
                {cell.value}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/40">--</span>
          )}
        </TableCell>
      ))}
    </TableRow>
  );
}
