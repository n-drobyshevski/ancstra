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
  SelectionMode,
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
import { DraftFactsheetNode } from './draft-factsheet-node';
import {
  treeDataToFlow,
  applyDagreLayout,
  applyPositionMap,
  extractPositions,
  validateConnection,
  type FilterState,
  DEFAULT_FILTERS,
  applyFilters,
  applyEdgeFilters,
} from './tree-utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const nodeTypes = { person: PersonNode, draftPerson: DraftPersonNode, draftFactsheet: DraftFactsheetNode };
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

  const initialNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    [rawNodes, rawEdges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // Sync nodes/edges when treeData changes (after router.refresh)
  const treeDataRef = useRef(treeData);
  useEffect(() => {
    if (treeDataRef.current === treeData) return;
    treeDataRef.current = treeData;

    // Preserve existing node positions
    setNodes((prev) => {
      const posMap: Record<string, { x: number; y: number }> = {};
      for (const n of prev) {
        if (n.type !== 'draftPerson') posMap[n.id] = n.position;
      }
      const laid = applyDagreLayout(rawNodes, rawEdges);
      return laid.map((n) => ({
        ...n,
        position: posMap[n.id] ?? n.position,
      }));
    });
    setEdges(rawEdges);
  }, [treeData, rawNodes, rawEdges, setNodes, setEdges]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] =
    useState<PersonListItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'node' | 'edge' | 'canvas';
    nodeId?: string;
    edgeId?: string;
    edgeType?: string;
    edgeFamilyId?: string;
    edgeChildId?: string;
  } | null>(null);

  // Layout management state
  const [layouts, setLayouts] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [activeLayoutName, setActiveLayoutName] = useState<string | null>(null);

  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTERS);

  const handleToggleFilter = useCallback((category: 'sex' | 'living', key: string) => {
    setFilterState(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key as keyof typeof prev[typeof category]],
      },
    }));
  }, []);

  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch layouts on mount and load default (or migrate localStorage)
  useEffect(() => {
    fetch('/api/layouts')
      .then((r) => r.json())
      .then((data) => {
        const list = data.layouts ?? [];
        setLayouts(list);
        const defaultLayout = list.find((l: { isDefault: boolean }) => l.isDefault);
        if (defaultLayout) {
          fetch(`/api/layouts/${defaultLayout.id}`)
            .then((r) => r.json())
            .then((layout) => {
              const positions = JSON.parse(layout.layoutData);
              setNodes(applyPositionMap(rawNodes, positions));
              setActiveLayoutId(layout.id);
              setActiveLayoutName(layout.name);
            });
        } else if (typeof window !== 'undefined' && localStorage.getItem('ancstra-tree-layout')) {
          const stored = localStorage.getItem('ancstra-tree-layout');
          if (stored) {
            const positions = JSON.parse(stored);
            setNodes(applyPositionMap(rawNodes, positions));
            fetch('/api/layouts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: 'Default', layoutData: stored, isDefault: true }),
            })
              .then((r) => r.json())
              .then((layout) => {
                setActiveLayoutId(layout.id);
                setActiveLayoutName('Default');
                setLayouts([{ id: layout.id, name: 'Default', isDefault: true }]);
              });
            localStorage.removeItem('ancstra-tree-layout');
          }
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to refresh the layouts list
  const refreshLayouts = useCallback(() => {
    fetch('/api/layouts')
      .then((r) => r.json())
      .then((data) => setLayouts(data.layouts ?? []));
  }, []);

  // Debounced auto-save on drag
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      if (
        activeLayoutId &&
        changes.some(
          (c) => c.type === 'position' && !('dragging' in c && c.dragging),
        )
      ) {
        clearTimeout(autoSaveRef.current);
        autoSaveRef.current = setTimeout(() => {
          setNodes((currentNodes) => {
            const positions = extractPositions(currentNodes);
            fetch(`/api/layouts/${activeLayoutId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ layoutData: JSON.stringify(positions) }),
            });
            return currentNodes;
          });
        }, 2000);
      }
    },
    [onNodesChange, setNodes, activeLayoutId],
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
        edgeType: edge.type as string,
        edgeFamilyId: (edge.data as any)?.familyId as string | undefined,
        edgeChildId: edge.type === 'parentChild' ? edge.target : undefined,
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
    const laid = applyDagreLayout(rawNodes, rawEdges);
    setNodes(laid);
    setActiveLayoutId(null);
    setActiveLayoutName(null);
  }, [rawNodes, rawEdges, setNodes]);

  const handleLoadLayout = useCallback(
    (id: string) => {
      fetch(`/api/layouts/${id}`)
        .then((r) => r.json())
        .then((layout) => {
          const positions = JSON.parse(layout.layoutData);
          setNodes(applyPositionMap(rawNodes, positions));
          setActiveLayoutId(layout.id);
          setActiveLayoutName(layout.name);
        });
    },
    [rawNodes, setNodes],
  );

  const handleSaveAsNew = useCallback(() => {
    const name = prompt('Layout name:');
    if (!name) return;
    setNodes((currentNodes) => {
      const positions = extractPositions(currentNodes);
      fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, layoutData: JSON.stringify(positions) }),
      })
        .then((r) => r.json())
        .then((layout) => {
          setActiveLayoutId(layout.id);
          setActiveLayoutName(name);
          refreshLayouts();
          toast.success(`Layout "${name}" saved`);
        });
      return currentNodes;
    });
  }, [setNodes, refreshLayouts]);

  const handleUpdateLayout = useCallback(() => {
    if (!activeLayoutId) {
      toast.error('No active layout to update');
      return;
    }
    setNodes((currentNodes) => {
      const positions = extractPositions(currentNodes);
      fetch(`/api/layouts/${activeLayoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutData: JSON.stringify(positions) }),
      }).then(() => {
        toast.success('Layout updated');
      });
      return currentNodes;
    });
  }, [activeLayoutId, setNodes]);

  const handleSetDefault = useCallback(() => {
    if (!activeLayoutId) return;
    fetch(`/api/layouts/${activeLayoutId}/default`, { method: 'PUT' }).then(() => {
      refreshLayouts();
      toast.success('Default layout set');
    });
  }, [activeLayoutId, refreshLayouts]);

  const handleRenameLayout = useCallback(() => {
    if (!activeLayoutId) return;
    const newName = prompt('New layout name:', activeLayoutName ?? '');
    if (!newName) return;
    fetch(`/api/layouts/${activeLayoutId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    }).then(() => {
      setActiveLayoutName(newName);
      refreshLayouts();
      toast.success(`Layout renamed to "${newName}"`);
    });
  }, [activeLayoutId, activeLayoutName, refreshLayouts]);

  const handleDeleteLayout = useCallback(() => {
    if (!activeLayoutId) return;
    if (!confirm('Delete this layout?')) return;
    fetch(`/api/layouts/${activeLayoutId}`, { method: 'DELETE' }).then(() => {
      setActiveLayoutId(null);
      setActiveLayoutName(null);
      refreshLayouts();
      toast.success('Layout deleted');
    });
  }, [activeLayoutId, refreshLayouts]);

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
    const transfer = event.dataTransfer.getData('application/ancstra');
    if (!transfer) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const draftId = `draft-${Date.now()}`;

    if (transfer === 'new-person') {
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
    } else if (transfer.startsWith('factsheet:')) {
      const factsheetId = transfer.slice('factsheet:'.length);
      setNodes((nds) => [
        ...nds,
        {
          id: draftId,
          type: 'draftFactsheet',
          position,
          data: {
            factsheetId,
            onPromoted: () => {
              setNodes((n) => n.filter((node) => node.id !== draftId));
              router.refresh();
            },
            onCancel: () => {
              setNodes((n) => n.filter((node) => node.id !== draftId));
            },
          },
        },
      ]);
    }

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

  // Edge disconnect-by-drag: drag an edge endpoint to empty canvas to delete it
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(() => {
    edgeReconnectSuccessful.current = true;
  }, []);

  const onReconnectEnd = useCallback(async (_event: MouseEvent | TouchEvent, edge: Edge) => {
    if (edgeReconnectSuccessful.current) return; // Was reconnected to another handle, not dropped

    // Edge was dropped on empty canvas → delete the relationship
    const edgeType = edge.type;
    const familyId = (edge.data as any)?.familyId as string | undefined;

    if (!familyId) return;

    try {
      if (edgeType === 'partner') {
        await fetch(`/api/families/${familyId}`, { method: 'DELETE' });
      } else if (edgeType === 'parentChild') {
        await fetch(`/api/families/${familyId}/children/${edge.target}`, { method: 'DELETE' });
      }
      toast.success('Relationship removed');
      router.refresh();
    } catch {
      toast.error('Failed to remove relationship');
    }
  }, [router]);

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

  // Apply filters when filterState changes
  useEffect(() => {
    setNodes(nds => applyFilters(nds, filterState));
  }, [filterState, setNodes]);

  // Compute filtered edges (dimmed based on node dimmed status)
  const filteredEdges = useMemo(() => applyEdgeFilters(edges, nodes), [edges, nodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPerson(null);
        setContextMenu(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setNodes(nds => nds.map(n => ({ ...n, selected: !(n.data as any)?.dimmed })));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setNodes]);

  return (
    <div className="relative flex h-full">
      <div
        className={`flex-1 transition-all ${selectedPerson ? 'mr-[400px]' : ''}`}
      >
        <ReactFlow
          aria-label="Family tree"
          nodes={nodes}
          edges={filteredEdges}
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
          onReconnectStart={onReconnectStart}
          onReconnect={onReconnect}
          onReconnectEnd={onReconnectEnd}
          edgesReconnectable
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          minZoom={0.1}
          maxZoom={2}
          deleteKeyCode="Delete"
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Shift"
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
          filterState={filterState}
          onToggleFilter={handleToggleFilter}
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
