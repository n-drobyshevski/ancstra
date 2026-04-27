// apps/web/components/research/canvas/cluster-view.tsx
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
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FactsheetNode } from './factsheet-node';
import { FactsheetLinkEdge } from './factsheet-link-edge';
import {
  buildClusterNodes,
  buildClusterEdges,
  layoutClusterNodes,
  detectClusters,
  computeClusterBounds,
  type ClusterBoundary,
} from './factsheet-graph-utils';
import type { Factsheet, FactsheetLink } from '@/lib/research/factsheet-client';
import { createFactsheetLink } from '@/lib/research/factsheet-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const nodeTypes = { factsheetNode: FactsheetNode };
const edgeTypes = { factsheetLink: FactsheetLinkEdge };

interface ClusterViewProps {
  factsheets: Factsheet[];
  links: FactsheetLink[];
  factCounts: Map<string, number>;
  onDrillDown: (factsheetId: string) => void;
  onRefresh: () => void;
}

export function ClusterView({
  factsheets,
  links,
  factCounts,
  onDrillDown,
  onRefresh,
}: ClusterViewProps) {
  const { fitView } = useReactFlow();

  const rawNodes = useMemo(
    () => buildClusterNodes(factsheets, links, factCounts),
    [factsheets, links, factCounts],
  );
  const rawEdges = useMemo(() => buildClusterEdges(links), [links]);
  const initialNodes = useMemo(() => layoutClusterNodes(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);
  const [clusters, setClusters] = useState<ClusterBoundary[]>([]);

  // Pending connection for link-type popover
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);

  // Compute cluster boundaries after layout
  useEffect(() => {
    const clusterIds = detectClusters(
      factsheets.map((f) => f.id),
      links,
    );
    const bounds = computeClusterBounds(clusterIds, nodes);
    setClusters(bounds);
  }, [nodes, factsheets, links]);

  // Re-layout when data changes
  useEffect(() => {
    const laid = layoutClusterNodes(rawNodes, rawEdges);
    setNodes(laid);
    setEdges(rawEdges);
  }, [rawNodes, rawEdges, setNodes, setEdges]);

  const handleAutoLayout = useCallback(() => {
    const laid = layoutClusterNodes(rawNodes, rawEdges);
    setNodes(laid);
    setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 50);
  }, [rawNodes, rawEdges, setNodes, fitView]);

  // Double-click to drill down
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onDrillDown(node.id);
    },
    [onDrillDown],
  );

  // Drag-to-link: show relationship type picker
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setPendingConnection(connection);
  }, []);

  const handleCreateLink = useCallback(
    async (relationshipType: string) => {
      if (!pendingConnection?.source || !pendingConnection?.target) return;
      try {
        await createFactsheetLink(
          pendingConnection.source,
          pendingConnection.target,
          relationshipType,
        );
        toast.success(`${relationshipType.replace('_', ' ')} link created`);
        onRefresh();
      } catch {
        toast.error('Failed to create link');
      }
      setPendingConnection(null);
    },
    [pendingConnection, onRefresh],
  );

  return (
    <div className="relative h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap position="bottom-left" zoomable pannable className="!bg-card !border !shadow-sm !rounded-lg" />
        <Controls position="bottom-right" className="!bg-card !border !shadow-sm !rounded-lg" />

        {/* Cluster boundaries rendered as SVG background */}
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 }}>
          {clusters.map((cluster) => (
            <g key={cluster.factsheetIds.join('-')}>
              <rect
                x={cluster.bounds.x}
                y={cluster.bounds.y}
                width={cluster.bounds.width}
                height={cluster.bounds.height}
                rx={16}
                fill="oklch(0.95 0.02 265 / 0.3)"
                stroke="oklch(0.80 0.05 265)"
                strokeWidth={1}
                strokeDasharray="6,3"
              />
              <text
                x={cluster.bounds.x + cluster.bounds.width / 2}
                y={cluster.bounds.y + 14}
                textAnchor="middle"
                fontSize={10}
                fill="oklch(0.60 0.08 265)"
                fontWeight={500}
              >
                {cluster.label}
              </text>
            </g>
          ))}
        </svg>
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex justify-between pointer-events-none">
        <div className="flex gap-1.5 pointer-events-auto">
          <Button variant="secondary" size="sm" className="shadow-sm" onClick={handleAutoLayout}>
            Auto Layout
          </Button>
        </div>
        <div className="pointer-events-auto">
          <span className="text-[10px] text-muted-foreground bg-card/80 px-2 py-1 rounded shadow-sm">
            Double-click to drill into evidence
          </span>
        </div>
      </div>

      {/* Link type popover */}
      {pendingConnection && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-card border rounded-lg shadow-lg p-3 space-y-1.5">
            <div className="text-xs font-semibold text-foreground mb-2">Link type:</div>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={() => handleCreateLink('parent_child')}>
              Parent → Child
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={() => handleCreateLink('spouse')}>
              Spouse
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start text-xs" onClick={() => handleCreateLink('sibling')}>
              Sibling
            </Button>
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setPendingConnection(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
