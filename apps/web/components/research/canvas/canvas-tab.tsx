'use client';

import { ReactFlowProvider } from '@xyflow/react';
import {
  usePersonResearchItems,
  usePersonConflicts,
} from '@/lib/research/evidence-client';
import { useCanvasPositions } from '@/lib/research/canvas-positions';
import { CanvasInner } from './canvas-inner';

interface CanvasTabProps {
  personId: string;
}

export function CanvasTab({ personId }: CanvasTabProps) {
  const { items, isLoading: itemsLoading } = usePersonResearchItems(personId);
  const { conflicts, isLoading: conflictsLoading } =
    usePersonConflicts(personId);
  const { positions, isLoading: positionsLoading } =
    useCanvasPositions(personId);

  const isLoading = itemsLoading || conflictsLoading || positionsLoading;

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-16rem)] rounded-lg border border-border bg-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm">Loading canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-16rem)] rounded-lg border border-border overflow-hidden">
      <ReactFlowProvider>
        <CanvasInner
          personId={personId}
          researchItems={items}
          positions={positions}
          conflicts={conflicts}
        />
      </ReactFlowProvider>
    </div>
  );
}
