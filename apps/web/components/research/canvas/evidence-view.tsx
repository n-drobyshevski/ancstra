// apps/web/components/research/canvas/evidence-view.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CenterFactsheetNode } from './center-factsheet-node';
import { FactNode } from './fact-node';
import { SourceResearchNode } from './source-research-node';
import {
  buildEvidenceNodes,
  layoutEvidenceNodes,
} from './factsheet-graph-utils';
import {
  useFactsheetDetail,
  useFactsheetConflicts,
  promoteFactsheet,
  resolveFactsheetConflict,
} from '@/lib/research/factsheet-client';
import { usePersonResearchItems } from '@/lib/research/evidence-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const nodeTypes = {
  centerFactsheet: CenterFactsheetNode,
  factNode: FactNode,
  sourceResearchNode: SourceResearchNode,
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Ready', className: 'bg-green-100 text-green-800' },
  promoted: { label: 'Promoted', className: 'bg-indigo-100 text-indigo-800' },
  merged: { label: 'Merged', className: 'bg-cyan-100 text-cyan-800' },
  dismissed: { label: 'Dismissed', className: 'bg-gray-100 text-gray-500' },
};

interface EvidenceViewProps {
  factsheetId: string;
  personId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function EvidenceView({
  factsheetId,
  personId,
  onBack,
  onRefresh,
}: EvidenceViewProps) {
  const { fitView } = useReactFlow();
  const { detail, isLoading: detailLoading, refetch: refetchDetail } = useFactsheetDetail(factsheetId);
  const { conflicts, refetch: refetchConflicts } = useFactsheetConflicts(factsheetId);
  const { items: researchItems } = usePersonResearchItems(personId);

  const conflictFactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of conflicts) {
      for (const f of c.facts) {
        if (f.accepted === null) ids.add(f.id);
      }
    }
    return ids;
  }, [conflicts]);

  const researchItemMap = useMemo(() => {
    const map = new Map<string, { title: string; provider: string | null }>();
    for (const item of researchItems) {
      map.set(item.id, { title: item.title, provider: item.providerId });
    }
    return map;
  }, [researchItems]);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    if (!detail) return { nodes: [], edges: [] };
    return buildEvidenceNodes(detail, researchItemMap, conflictFactIds);
  }, [detail, researchItemMap, conflictFactIds]);

  const layoutNodes = useMemo(() => layoutEvidenceNodes(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  useEffect(() => {
    const laid = layoutEvidenceNodes(rawNodes, rawEdges);
    setNodes(laid);
    setEdges(rawEdges);
    setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 100);
  }, [rawNodes, rawEdges, setNodes, setEdges, fitView]);

  const [isPromoting, setIsPromoting] = useState(false);

  const handlePromote = useCallback(async () => {
    if (!detail) return;
    setIsPromoting(true);
    try {
      await promoteFactsheet(detail.id, 'create');
      toast.success('Factsheet promoted to tree');
      onRefresh();
      onBack();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Promotion failed');
    } finally {
      setIsPromoting(false);
    }
  }, [detail, onRefresh, onBack]);

  const hasUnresolvedConflicts = conflictFactIds.size > 0;

  if (detailLoading || !detail) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.draft;

  return (
    <div className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap position="bottom-left" zoomable pannable className="!bg-card !border !shadow-sm !rounded-lg" />
        <Controls position="bottom-right" className="!bg-card !border !shadow-sm !rounded-lg" />
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button variant="ghost" size="sm" className="shadow-sm gap-1 text-primary" onClick={onBack}>
            <ArrowLeft className="size-3.5" />
            Back to Clusters
          </Button>
          <span className="text-[12px] font-semibold text-foreground">{detail.title}</span>
          <Badge variant="secondary" className={`text-[9px] ${statusConfig.className}`}>
            {statusConfig.label}
          </Badge>
        </div>
        <div className="pointer-events-auto">
          <Button
            size="sm"
            disabled={isPromoting || hasUnresolvedConflicts || detail.status === 'promoted' || detail.status === 'merged'}
            onClick={handlePromote}
            title={hasUnresolvedConflicts ? 'Resolve all conflicts before promoting' : undefined}
          >
            {isPromoting ? 'Promoting...' : 'Promote'}
          </Button>
        </div>
      </div>
    </div>
  );
}
