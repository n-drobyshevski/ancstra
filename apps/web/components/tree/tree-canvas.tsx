'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type Connection,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { PersonListItem, TreeData } from '@ancstra/shared';
import { PersonNode } from './person-node';
import { PartnerEdge } from './partner-edge';
import { ParentChildEdge } from './parent-child-edge';
import { TreeToolbar } from './tree-toolbar';
import { PersonPalette } from './person-palette';
import { TreeContextMenu } from './tree-context-menu';
import { TreeDetailPanel } from './tree-detail-panel';
import { DraftPersonNode } from './draft-person-node';
import {
  treeDataToFlow,
  applyDagreLayout,
  savePositions,
  loadPositions,
  clearPositions,
  applyStoredPositions,
  validateConnection,
} from './tree-utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const nodeTypes = { person: PersonNode, draftPerson: DraftPersonNode };
const edgeTypes = { partner: PartnerEdge, parentChild: ParentChildEdge };

interface TreeCanvasProps {
  treeData: TreeData;
  focusPersonId?: string;
}

function TreeCanvasInner({ treeData, focusPersonId }: TreeCanvasProps) {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const router = useRouter();

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

  const [paletteOpen, setPaletteOpen] = useState(false);
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

  // Layout management stubs (wired up in Task 3)
  const [layouts] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);
  const [activeLayoutId] = useState<string | null>(null);
  const [activeLayoutName] = useState<string | null>(null);
  const handleLoadLayout = useCallback((_id: string) => {}, []);
  const handleSaveAsNew = useCallback(() => { handleSaveLayout(); }, [handleSaveLayout]);
  const handleUpdateLayout = useCallback(() => { handleSaveLayout(); }, [handleSaveLayout]);
  const handleSetDefault = useCallback(() => {}, []);
  const handleDeleteLayout = useCallback(() => {}, []);
  const handleRenameLayout = useCallback(() => {}, []);

  const handleClosePanel = useCallback(() => setSelectedPerson(null), []);

  const handleFocusNode = useCallback(
    (personId: string) => {
      const person = treeData.persons.find((p) => p.id === personId);
      if (person) setSelectedPerson(person);
    },
    [treeData],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/ancstra');
    if (type !== 'new-person') return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const draftId = `draft-${Date.now()}`;

    setNodes((nds) => [
      ...nds,
      {
        id: draftId,
        type: 'draftPerson',
        position,
        data: {
          onSave: () => {
            setNodes((n) => n.filter((node) => node.id !== draftId));
            router.refresh();
          },
          onCancel: () => {
            setNodes((n) => n.filter((node) => node.id !== draftId));
          },
        },
      },
    ]);
    setPaletteOpen(false);
  }, [screenToFlowPosition, setNodes, router]);

  const onConnect = useCallback(async (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target) return;

    const isSpouse = sourceHandle === 'right' && targetHandle === 'left';
    const type = isSpouse ? 'spouse' as const : 'parentChild' as const;

    const validation = validateConnection(treeData, source, target, type);
    if (!validation.valid) {
      toast.error(validation.error ?? 'Invalid connection');
      return;
    }

    try {
      if (isSpouse) {
        const res = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partner1Id: source, partner2Id: target }),
        });
        if (!res.ok) { toast.error('Failed to create relationship'); return; }
      } else {
        const famRes = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partner1Id: source }),
        });
        if (!famRes.ok) { toast.error('Failed to create family'); return; }
        const family = await famRes.json();
        const childRes = await fetch(`/api/families/${family.id}/children`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: target }),
        });
        if (!childRes.ok) { toast.error('Failed to link child'); return; }
      }
      toast.success(isSpouse ? 'Spouse linked' : 'Parent-child linked');
      router.refresh();
    } catch { toast.error('Network error'); }
  }, [treeData, router]);

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
          connectionMode={ConnectionMode.Loose}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          minZoom={0.1}
          maxZoom={2}
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
          onTogglePalette={() => setPaletteOpen((v) => !v)}
          paletteOpen={paletteOpen}
          layouts={layouts}
          activeLayoutId={activeLayoutId}
          activeLayoutName={activeLayoutName}
          onLoadLayout={handleLoadLayout}
          onSaveAsNew={handleSaveAsNew}
          onUpdateLayout={handleUpdateLayout}
          onSetDefault={handleSetDefault}
          onDeleteLayout={handleDeleteLayout}
          onRenameLayout={handleRenameLayout}
        />

        {paletteOpen && (
          <PersonPalette onClose={() => setPaletteOpen(false)} />
        )}

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
