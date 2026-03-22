'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type Edge,
  type OnNodesChange,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { PersonListItem, TreeData } from '@ancstra/shared';
import { PersonNode } from './person-node';
import { PartnerEdge } from './partner-edge';
import { ParentChildEdge } from './parent-child-edge';
import { TreeToolbar } from './tree-toolbar';
import { TreeContextMenu } from './tree-context-menu';
import { TreeDetailPanel } from './tree-detail-panel';
import {
  treeDataToFlow,
  applyDagreLayout,
  savePositions,
  loadPositions,
  clearPositions,
  applyStoredPositions,
} from './tree-utils';

const nodeTypes = { person: PersonNode };
const edgeTypes = { partner: PartnerEdge, parentChild: ParentChildEdge };

interface TreeCanvasProps {
  treeData: TreeData;
  focusPersonId?: string;
}

function TreeCanvasInner({ treeData, focusPersonId }: TreeCanvasProps) {
  const { fitView } = useReactFlow();

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => treeDataToFlow(treeData),
    [treeData],
  );

  const initialNodes = useMemo(() => {
    const stored = loadPositions();
    if (stored) return applyStoredPositions(rawNodes, stored);
    return applyDagreLayout(rawNodes, rawEdges);
  }, [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(rawEdges);

  const [selectedPerson, setSelectedPerson] =
    useState<PersonListItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'node' | 'edge' | 'canvas';
    nodeId?: string;
    edgeId?: string;
  } | null>(null);

  // Debounced position save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      if (
        changes.some(
          (c) => c.type === 'position' && !('dragging' in c && c.dragging),
        )
      ) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          setNodes((currentNodes) => {
            savePositions(currentNodes);
            return currentNodes;
          });
        }, 500);
      }
    },
    [onNodesChange, setNodes],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const person = treeData.persons.find((p) => p.id === node.id);
      if (person) setSelectedPerson(person);
      setContextMenu(null);
    },
    [treeData],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        nodeId: node.id,
      });
    },
    [],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'edge',
        edgeId: edge.id,
      });
    },
    [],
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'canvas',
      });
    },
    [],
  );

  const onPaneClick = useCallback(() => setContextMenu(null), []);

  const handleAutoLayout = useCallback(() => {
    clearPositions();
    const laid = applyDagreLayout(rawNodes, rawEdges);
    setNodes(laid);
    savePositions(laid);
  }, [rawNodes, rawEdges, setNodes]);

  const handleSaveLayout = useCallback(() => {
    setNodes((currentNodes) => {
      savePositions(currentNodes);
      return currentNodes;
    });
  }, [setNodes]);

  const handleClosePanel = useCallback(() => setSelectedPerson(null), []);

  const handleFocusNode = useCallback(
    (personId: string) => {
      const person = treeData.persons.find((p) => p.id === personId);
      if (person) setSelectedPerson(person);
    },
    [treeData],
  );

  // Focus on person when focusPersonId is provided (e.g. from /tree?focus=...)
  useEffect(() => {
    if (!focusPersonId) return;
    // Small delay to let React Flow render nodes first
    const timer = setTimeout(() => {
      fitView({ nodes: [{ id: focusPersonId }], duration: 500, padding: 0.5 });
      const person = treeData.persons.find((p) => p.id === focusPersonId);
      if (person) setSelectedPerson(person);
    }, 200);
    return () => clearTimeout(timer);
  }, [focusPersonId, fitView, treeData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPerson(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative flex h-full">
      <div
        className={`flex-1 transition-all ${selectedPerson ? 'mr-[400px]' : ''}`}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          nodesConnectable={false}
          deleteKeyCode="Delete"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap
            position="bottom-left"
            zoomable
            pannable
            className="!bg-card !border !shadow-sm !rounded-lg"
          />
          <Controls
            position="bottom-right"
            className="!bg-card !border !shadow-sm !rounded-lg"
          />
        </ReactFlow>

        <TreeToolbar
          onAutoLayout={handleAutoLayout}
          onSaveLayout={handleSaveLayout}
        />

        {contextMenu && (
          <TreeContextMenu
            {...contextMenu}
            persons={treeData.persons}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>

      {selectedPerson && (
        <TreeDetailPanel
          person={selectedPerson}
          treeData={treeData}
          onClose={handleClosePanel}
          onFocusNode={handleFocusNode}
        />
      )}
    </div>
  );
}

export function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
