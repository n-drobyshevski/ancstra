'use client';

import { useCallback, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useFactsheets } from '@/lib/research/factsheet-client';
import { useAllFactsheetLinks } from '@/lib/research/use-all-factsheet-links';
import { ClusterView } from './cluster-view';
import { EvidenceView } from './evidence-view';

interface CanvasTabProps {
  personId: string;
}

export function CanvasTab({ personId }: CanvasTabProps) {
  const { factsheets, isLoading: fsLoading, refetch: refetchFs } = useFactsheets(personId);
  const { links, isLoading: linksLoading, refetch: refetchLinks } = useAllFactsheetLinks(factsheets);

  const [drillDownId, setDrillDownId] = useState<string | null>(null);

  const isLoading = fsLoading || linksLoading;

  const factCounts = useMemo(() => {
    const map = new Map<string, number>();
    // We don't have fact counts from the list endpoint, so show 0 for now
    // The detail fetch in evidence view has the actual counts
    for (const fs of factsheets) {
      map.set(fs.id, 0);
    }
    return map;
  }, [factsheets]);

  const handleRefresh = useCallback(() => {
    refetchFs();
    refetchLinks();
  }, [refetchFs, refetchLinks]);

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

  if (factsheets.length === 0) {
    return (
      <div className="h-[calc(100vh-16rem)] rounded-lg border border-border bg-muted/30 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-sm font-medium">No factsheets yet</p>
          <p className="text-xs mt-1">Create factsheets in the Factsheets tab to visualize them here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-16rem)] rounded-lg border border-border overflow-hidden">
      <ReactFlowProvider>
        {drillDownId ? (
          <EvidenceView
            factsheetId={drillDownId}
            personId={personId}
            onBack={() => setDrillDownId(null)}
            onRefresh={handleRefresh}
          />
        ) : (
          <ClusterView
            factsheets={factsheets}
            links={links}
            factCounts={factCounts}
            onDrillDown={setDrillDownId}
            onRefresh={handleRefresh}
          />
        )}
      </ReactFlowProvider>
    </div>
  );
}
