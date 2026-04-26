'use client';

import { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  ConnectionMode,
  useNodesState, useEdgesState,
  type Node, type Edge, type Connection, type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FactsheetGraphNode, type FactsheetNodeData } from './factsheet-graph-node';
import { FactsheetGraphEdge } from './factsheet-graph-edge';
import type { FactsheetWithCounts, FactsheetLink } from '@/lib/research/factsheet-client';
import { useConnectionLock } from '@/lib/graph/use-connection-lock';
import { classifyApiError } from '@/lib/api/classify-error';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  validateFactsheetLink,
  formatFactsheetViolation,
  DEFAULT_LINK_TYPE,
} from '@/lib/research/validate-factsheet-link';

const nodeTypes = { factsheet: FactsheetGraphNode };
const edgeTypes = { factsheetEdge: FactsheetGraphEdge };

const LOCK_KEY = 'factsheet-link';

interface FactsheetGraphViewProps {
  factsheets: FactsheetWithCounts[];
  links: FactsheetLink[];
  selectedId: string | null;
  onSelectFactsheet: (id: string) => void;
  onPromoteCluster?: (factsheets: FactsheetWithCounts[]) => void;
  onLinksChanged?: () => void;
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

export function FactsheetGraphView({
  factsheets,
  links,
  selectedId,
  onSelectFactsheet,
  onPromoteCluster,
  onLinksChanged,
}: FactsheetGraphViewProps) {
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
      sourceHandle: link.sourceHandle ?? undefined,
      targetHandle: link.targetHandle ?? undefined,
      type: 'factsheetEdge',
    })),
  [links]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-sync when underlying data changes (parent refetches after a link mutation).
  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const isMobile = useIsMobile();

  const connectionLock = useConnectionLock<typeof LOCK_KEY>({
    symmetricTypes: [LOCK_KEY],
  });

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

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const source = connection.source;
      const target = connection.target;
      if (!source || !target) return false;
      return validateFactsheetLink({ source, target, links }) === null;
    },
    [links],
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) return;

      if (connectionLock.isLocked(source, target, LOCK_KEY)) {
        toast.info('Connection already in progress…');
        return;
      }

      const violation = validateFactsheetLink({ source, target, links });
      if (violation) {
        toast.error(formatFactsheetViolation(violation));
        return;
      }

      connectionLock.lock(source, target, LOCK_KEY);
      const sourceTitle = factsheets.find((fs) => fs.id === source)?.title ?? 'Factsheet';
      const targetTitle = factsheets.find((fs) => fs.id === target)?.title ?? 'Factsheet';
      const toastId = toast.loading(`Linking: ${sourceTitle} — ${targetTitle}`);

      const pendingId = `pending-${crypto.randomUUID()}`;
      const pendingEdge: Edge = {
        id: pendingId,
        type: 'factsheetEdge',
        source,
        target,
        sourceHandle: sourceHandle ?? undefined,
        targetHandle: targetHandle ?? undefined,
        data: { pending: true },
      };
      setEdges((eds) => [...eds, pendingEdge]);

      try {
        const res = await fetch(`/api/research/factsheets/${source}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toFactsheetId: target,
            relationshipType: DEFAULT_LINK_TYPE,
            sourceHandle: sourceHandle ?? null,
            targetHandle: targetHandle ?? null,
          }),
        });
        if (!res.ok) {
          setEdges((eds) => eds.filter((e) => e.id !== pendingId));
          toast.error(classifyApiError(res), { id: toastId });
          return;
        }
        const created = (await res.json()) as { id?: string };
        const persistedId = typeof created.id === 'string' ? created.id : `link-${pendingId}`;
        setEdges((eds) =>
          eds
            .filter((e) => e.id !== pendingId)
            .concat({
              id: persistedId,
              type: 'factsheetEdge',
              source,
              target,
              sourceHandle: sourceHandle ?? undefined,
              targetHandle: targetHandle ?? undefined,
            }),
        );
        toast.success('Linked', { id: toastId });
        onLinksChanged?.();
      } catch {
        setEdges((eds) => eds.filter((e) => e.id !== pendingId));
        toast.error('Network error — check your connection', { id: toastId });
      } finally {
        connectionLock.unlock(source, target, LOCK_KEY);
      }
    },
    [connectionLock, factsheets, links, onLinksChanged, setEdges],
  );

  // Edge pull-off gesture: drag an edge endpoint to empty canvas to delete the
  // link. Mirrors the pattern in tree-canvas.tsx (deleteRelationship + reconnect
  // handlers) — optimistic remove with a 5-second undo window before the API
  // call fires.
  const pendingDeletesRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const deleteLink = useCallback((edge: Edge) => {
    const linkId = edge.id;
    const fromId = edge.source;
    if (!linkId || !fromId || linkId.startsWith('pending-')) return;

    setEdges((eds) => eds.filter((e) => e.id !== edge.id));

    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(edge.id);
      try {
        const res = await fetch(`/api/research/factsheets/${fromId}/links`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkId }),
        });
        if (!res.ok && res.status !== 404) {
          toast.error(classifyApiError(res));
          setEdges((eds) => [...eds, edge]);
        } else {
          onLinksChanged?.();
        }
      } catch {
        toast.error('Network error — check your connection');
        setEdges((eds) => [...eds, edge]);
      }
    }, 5000);

    pendingDeletesRef.current.set(edge.id, timeoutId);

    toast('Link removed', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const tid = pendingDeletesRef.current.get(edge.id);
          if (tid) {
            clearTimeout(tid);
            pendingDeletesRef.current.delete(edge.id);
          }
          setEdges((eds) => [...eds, edge]);
        },
      },
    });
  }, [setEdges, onLinksChanged]);

  // Cancel any in-flight pending deletes on unmount.
  useEffect(() => {
    const pending = pendingDeletesRef.current;
    return () => {
      for (const tid of pending.values()) clearTimeout(tid);
    };
  }, []);

  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(() => {
    edgeReconnectSuccessful.current = true;
  }, []);

  const onReconnectEnd = useCallback((_event: MouseEvent | TouchEvent, edge: Edge) => {
    if (edgeReconnectSuccessful.current) return;
    deleteLink(edge);
  }, [deleteLink]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        edgesReconnectable={!isMobile}
        reconnectRadius={20}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ maxZoom: 1.1, padding: 0.3 }}
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
