'use client';

import { useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { FactsheetGraphNode, type FactsheetNodeData } from './factsheet-graph-node';
import { FactsheetGraphEdge } from './factsheet-graph-edge';
import type { FactsheetWithCounts, FactsheetLink } from '@/lib/research/factsheet-client';

const nodeTypes = { factsheet: FactsheetGraphNode };
const edgeTypes = { factsheetEdge: FactsheetGraphEdge };

interface FactsheetGraphViewProps {
  factsheets: FactsheetWithCounts[];
  links: FactsheetLink[];
  selectedId: string | null;
  onSelectFactsheet: (id: string) => void;
  onPromoteCluster?: (factsheets: FactsheetWithCounts[]) => void;
}

function computeGridPositions(count: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  return Array.from({ length: count }, (_, i) => ({
    x: (i % cols) * 220 + 50,
    y: Math.floor(i / cols) * 140 + 50,
  }));
}

function findClusters(factsheets: FactsheetWithCounts[], links: FactsheetLink[]) {
  const adj = new Map<string, Set<string>>();
  for (const fs of factsheets) adj.set(fs.id, new Set());
  for (const link of links) {
    adj.get(link.fromFactsheetId)?.add(link.toFactsheetId);
    adj.get(link.toFactsheetId)?.add(link.fromFactsheetId);
  }
  const visited = new Set<string>();
  const clusters: Set<string>[] = [];
  for (const fsId of adj.keys()) {
    if (visited.has(fsId)) continue;
    const cluster = new Set<string>();
    const queue = [fsId];
    while (queue.length > 0) {
      const curr = queue.pop()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      cluster.add(curr);
      for (const neighbor of adj.get(curr) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    if (cluster.size > 1) clusters.push(cluster);
  }
  return clusters;
}

export function FactsheetGraphView({ factsheets, links, selectedId, onSelectFactsheet, onPromoteCluster }: FactsheetGraphViewProps) {
  const initialNodes = useMemo<Node[]>(() => {
    const positions = computeGridPositions(factsheets.length);
    return factsheets.map((fs, i) => ({
      id: fs.id,
      type: 'factsheet',
      position: positions[i],
      data: {
        title: fs.title,
        status: fs.status,
        entityType: fs.entityType,
        factCount: fs.factCount,
        isUnanchored: fs.isUnanchored,
        isSelected: fs.id === selectedId,
      } satisfies FactsheetNodeData,
    }));
  }, [factsheets, selectedId]);

  const initialEdges = useMemo<Edge[]>(() =>
    links.map((link) => ({
      id: link.id,
      source: link.fromFactsheetId,
      target: link.toFactsheetId,
      type: 'factsheetEdge',
      data: { relationshipType: link.relationshipType, confidence: link.confidence },
    })),
  [links]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const clusters = useMemo(() => findClusters(factsheets, links), [factsheets, links]);

  const selectedCluster = useMemo(() => {
    if (!selectedId) return null;
    for (const members of clusters) {
      if (members.has(selectedId)) {
        return factsheets.filter((fs) => members.has(fs.id));
      }
    }
    return null;
  }, [selectedId, clusters, factsheets]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onSelectFactsheet(node.id),
    [onSelectFactsheet]
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ maxZoom: 0.8, padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/20"
      >
        <Background gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const d = node.data as FactsheetNodeData;
            if (d.isUnanchored) return '#f59e0b';
            if (d.status === 'ready') return '#10b981';
            if (d.status === 'promoted') return '#4f46e5';
            return '#818cf8';
          }}
          className="!bottom-4 !right-4"
        />
      </ReactFlow>

      {selectedCluster && selectedCluster.length > 1 && onPromoteCluster && (
        <div className="absolute bottom-4 left-4 z-10">
          <Button onClick={() => onPromoteCluster(selectedCluster)} className="shadow-lg">
            Promote Family Unit ({selectedCluster.length})
          </Button>
        </div>
      )}
    </div>
  );
}
