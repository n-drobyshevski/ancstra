'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
  type Connection,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { PersonListItem, TreeData } from '@ancstra/shared';
import { cn } from '@/lib/utils';
import { PersonNode } from './person-node';
import { PartnerEdge } from './partner-edge';
import { ParentChildEdge } from './parent-child-edge';
import { TreeToolbar } from './tree-toolbar';
import { TreeContextMenu } from './tree-context-menu';
import { DraftPersonNode } from './draft-person-node';
import { DraftFactsheetNode } from './draft-factsheet-node';
import {
  treeDataToFlow,
  applyDagreLayout,
  applyPositionMap,
  extractPositions,
  validateConnection,
  parseLayoutData,
  serializeLayoutData,
  type FilterState,
  type NodeStyle,
  DEFAULT_FILTERS,
  applyFilters,
  applyEdgeFilters,
} from './tree-utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQualityData } from '@/lib/tree/use-quality-data';
import { useConnectionLock } from '@/lib/graph/use-connection-lock';
import { classifyApiError } from '@/lib/api/classify-error';

const nodeTypes = { person: PersonNode, draftPerson: DraftPersonNode, draftFactsheet: DraftFactsheetNode };
const edgeTypes = { partner: PartnerEdge, parentChild: ParentChildEdge };

interface TreeCanvasProps {
  treeData: TreeData;
  focusPersonId?: string;
  focusKey?: number;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  onSelectPerson: (person: PersonListItem | null) => void;
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
  isMobile?: boolean;
  isDetailOpen?: boolean;
  /** External filter state — when provided, canvas uses these instead of internal state */
  filterState?: FilterState;
  onFilterStateChange?: (fs: FilterState) => void;
  showGaps?: boolean;
  onShowGapsChange?: (v: boolean) => void;
  mobileToolbarSlot?: (props: {
    onAutoLayout: () => void;
    onExportPng: () => void;
    onExportSvg: () => void;
    onExportPdf: () => void;
  }) => React.ReactNode;
}

function TreeCanvasInner({ treeData, focusPersonId, focusKey, paletteOpen, onTogglePalette, onSelectPerson, view, onSetView, isMobile, isDetailOpen, filterState: externalFilterState, onFilterStateChange, showGaps: externalShowGaps, onShowGapsChange, mobileToolbarSlot }: TreeCanvasProps) {
  const { fitView, screenToFlowPosition, getNodes } = useReactFlow();
  const router = useRouter();
  const connectionLock = useConnectionLock<'spouse' | 'parentChild'>({
    symmetricTypes: ['spouse'],
  });

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => treeDataToFlow(treeData),
    [treeData],
  );

  const initStyle: NodeStyle = isMobile ? 'compact' : 'wide';
  const initialNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges, undefined, initStyle).map(
      n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: initStyle } } : n
    ),
    [rawNodes, rawEdges, initStyle],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

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

  const [internalFilterState, setInternalFilterState] = useState<FilterState>(DEFAULT_FILTERS);
  const [internalShowGaps, setInternalShowGaps] = useState(false);

  // Use external state when provided, otherwise fall back to internal
  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterStateChange ?? setInternalFilterState;
  const showGaps = externalShowGaps ?? internalShowGaps;
  const setShowGaps = onShowGapsChange ?? setInternalShowGaps;
  const [showMinimap, setShowMinimap] = useState(true);
  const [nodeStyle, setNodeStyle] = useState<NodeStyle>('wide');
  const effectiveNodeStyle = isMobile ? 'compact' : nodeStyle;
  const { qualityData } = useQualityData(showGaps, treeData.persons);
  const [, startTransition] = useTransition();

  // Sync nodes/edges when treeData changes (after router.refresh)
  const treeDataRef = useRef(treeData);
  useEffect(() => {
    if (treeDataRef.current === treeData) return;
    treeDataRef.current = treeData;

    startTransition(() => {
      // Preserve existing node positions
      setNodes((prev) => {
        const posMap: Record<string, { x: number; y: number }> = {};
        for (const n of prev) {
          if (n.type !== 'draftPerson') posMap[n.id] = n.position;
        }
        const laid = applyDagreLayout(rawNodes, rawEdges, showGaps ? 82 : undefined, effectiveNodeStyle);
        return laid.map((n) => ({
          ...n,
          position: posMap[n.id] ?? n.position,
          data: { ...n.data, nodeStyle: effectiveNodeStyle },
        }));
      });
      // Replace with server edges, keeping any optimistic edges not yet in server data
      setEdges((prev) => {
        const serverIds = new Set(rawEdges.map(e => e.id));
        const optimistic = prev.filter(e => !serverIds.has(e.id));
        return [...rawEdges, ...optimistic];
      });
    });
  }, [treeData, rawNodes, rawEdges, setNodes, setEdges, showGaps, effectiveNodeStyle]);

  const handleToggleFilter = useCallback((category: 'sex' | 'living', key: string) => {
    const next = {
      ...filterState,
      [category]: {
        ...filterState[category],
        [key]: !filterState[category][key as keyof typeof filterState[typeof category]],
      },
    };
    setFilterState(next);
  }, [filterState, setFilterState]);

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
              const { positions, nodeStyle: savedStyle } = parseLayoutData(layout.layoutData);
              const style = isMobile ? 'compact' : (savedStyle ?? 'wide');
              const positioned = applyPositionMap(rawNodes, positions);
              setNodes(positioned.map(n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: style } } : n));
              setActiveLayoutId(layout.id);
              setActiveLayoutName(layout.name);
              if (savedStyle) setNodeStyle(savedStyle);
            });
        } else if (typeof window !== 'undefined' && localStorage.getItem('ancstra-tree-layout')) {
          const stored = localStorage.getItem('ancstra-tree-layout');
          if (stored) {
            const { positions } = parseLayoutData(stored);
            const positioned = applyPositionMap(rawNodes, positions);
            setNodes(positioned.map(n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: effectiveNodeStyle } } : n));
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
              body: JSON.stringify({ layoutData: serializeLayoutData(positions, effectiveNodeStyle) }),
            });
            return currentNodes;
          });
        }, 2000);
      }
    },
    [onNodesChange, setNodes, activeLayoutId, effectiveNodeStyle],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const person = treeData.persons.find((p) => p.id === node.id);
      if (person) onSelectPerson(person);
      setContextMenu(null);
    },
    [treeData, onSelectPerson],
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
        edgeFamilyId: (edge.data as { familyId?: string })?.familyId,
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
    const laid = applyDagreLayout(rawNodes, rawEdges, showGaps ? 82 : undefined, effectiveNodeStyle);
    setNodes(laid.map(n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: effectiveNodeStyle } } : n));
    setActiveLayoutId(null);
    setActiveLayoutName(null);
  }, [rawNodes, rawEdges, setNodes, showGaps, effectiveNodeStyle]);

  const handleNodeStyleChange = useCallback((style: NodeStyle) => {
    setNodeStyle(style);
    setNodes(nds => nds.map(n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: style } } : n));
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [setNodes, fitView]);

  const handleLoadLayout = useCallback(
    (id: string) => {
      fetch(`/api/layouts/${id}`)
        .then((r) => r.json())
        .then((layout) => {
          const { positions, nodeStyle: savedStyle } = parseLayoutData(layout.layoutData);
          const style = isMobile ? 'compact' : (savedStyle ?? 'wide');
          const positioned = applyPositionMap(rawNodes, positions);
          setNodes(positioned.map(n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: style } } : n));
          setActiveLayoutId(layout.id);
          setActiveLayoutName(layout.name);
          setNodeStyle(savedStyle ?? 'wide');
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
        body: JSON.stringify({ name, layoutData: serializeLayoutData(positions, effectiveNodeStyle) }),
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
  }, [setNodes, refreshLayouts, effectiveNodeStyle]);

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
        body: JSON.stringify({ layoutData: serializeLayoutData(positions, effectiveNodeStyle) }),
      }).then(() => {
        toast.success('Layout updated');
      });
      return currentNodes;
    });
  }, [activeLayoutId, setNodes, effectiveNodeStyle]);

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

    if (paletteOpen) onTogglePalette();
  }, [screenToFlowPosition, setNodes, router, paletteOpen, onTogglePalette]);

  // Restrict handle pairing: bottom→top (parent-child), right→left (spouse)
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || source === target) return false;
    // Spouse: right source → left target only
    if (sourceHandle === 'right') return targetHandle === 'left';
    // Parent-child: default source (bottom) → default target (top) only
    if (!sourceHandle) return !targetHandle;
    return false;
  }, []);

  const onConnect = useCallback(async (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target) return;

    const isSpouse = sourceHandle === 'right' && targetHandle === 'left';
    const type = isSpouse ? 'spouse' as const : 'parentChild' as const;

    if (connectionLock.isLocked(source, target, type)) {
      toast.info('Connection already in progress...');
      return;
    }

    const currentTreeData = treeDataRef.current;
    const validation = validateConnection(currentTreeData, source, target, type);
    if (!validation.valid) {
      toast.error(validation.error ?? 'Invalid connection');
      return;
    }

    const sourcePerson = currentTreeData.persons.find((p) => p.id === source);
    const targetPerson = currentTreeData.persons.find((p) => p.id === target);
    const sourceName = sourcePerson ? `${sourcePerson.givenName} ${sourcePerson.surname}` : 'Person';
    const targetName = targetPerson ? `${targetPerson.givenName} ${targetPerson.surname}` : 'Person';
    const linkLabel = isSpouse ? 'Spouse' : 'Parent → Child';

    connectionLock.lock(source, target, type);
    const toastId = toast.loading(`Linking ${linkLabel}: ${sourceName} — ${targetName}`);

    // Add pending edge immediately for visual feedback
    const pendingId = `pending-${Date.now()}`;
    const pendingEdge: Edge = isSpouse
      ? { id: pendingId, type: 'partner', source, target, sourceHandle: 'right', targetHandle: 'left', data: { familyId: '', pending: true } }
      : { id: pendingId, type: 'parentChild', source, target, data: { validationStatus: 'confirmed', familyId: '', pending: true } };
    setEdges(eds => [...eds, pendingEdge]);

    try {
      if (isSpouse) {
        const res = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partner1Id: source, partner2Id: target }),
        });
        if (!res.ok) {
          setEdges(eds => eds.filter(e => e.id !== pendingId));
          toast.error(classifyApiError(res), { id: toastId });
          return;
        }
        const family = await res.json();
        // Replace pending edge with confirmed edge
        setEdges(eds => eds.filter(e => e.id !== pendingId).concat({
          id: `partner-${family.id}`,
          type: 'partner',
          source,
          target,
          sourceHandle: 'right',
          targetHandle: 'left',
          data: { familyId: family.id },
        }));
      } else {
        const res = await fetch('/api/families/with-child', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: source, childId: target }),
        });
        if (!res.ok) {
          setEdges(eds => eds.filter(e => e.id !== pendingId));
          toast.error(classifyApiError(res), { id: toastId });
          return;
        }
        const { familyId } = await res.json();
        // Replace pending edge with confirmed edge
        setEdges(eds => eds.filter(e => e.id !== pendingId).concat({
          id: `pc-${source}-${target}`,
          type: 'parentChild',
          source,
          target,
          data: { validationStatus: 'confirmed', familyId },
        }));
      }
      toast.success(isSpouse ? 'Spouse linked' : 'Parent-child linked', { id: toastId });
      router.refresh();
    } catch {
      setEdges(eds => eds.filter(e => e.id !== pendingId));
      toast.error('Network error — check your connection', { id: toastId });
    }
    finally { connectionLock.unlock(source, target, type); }
  }, [setEdges, connectionLock, router]);

  // Shared delete helper with undo support
  const pendingDeletesRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const deleteRelationship = useCallback((edge: Edge) => {
    const edgeType = edge.type;
    const familyId = (edge.data as { familyId?: string })?.familyId;
    if (!familyId) return;

    // Optimistic: remove edge immediately
    setEdges(eds => eds.filter(e => e.id !== edge.id));

    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(edge.id);
      try {
        let res: Response;
        if (edgeType === 'partner') {
          res = await fetch(`/api/families/${familyId}`, { method: 'DELETE' });
        } else if (edgeType === 'parentChild') {
          res = await fetch(`/api/families/${familyId}/children/${edge.target}`, { method: 'DELETE' });
        } else return;
        if (!res.ok && res.status !== 404) {
          toast.error(classifyApiError(res));
          setEdges(eds => [...eds, edge]);
        } else {
          router.refresh();
        }
      } catch {
        toast.error('Network error — check your connection');
        setEdges(eds => [...eds, edge]);
      }
    }, 5000);

    pendingDeletesRef.current.set(edge.id, timeoutId);

    toast('Relationship removed', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const tid = pendingDeletesRef.current.get(edge.id);
          if (tid) { clearTimeout(tid); pendingDeletesRef.current.delete(edge.id); }
          setEdges(eds => [...eds, edge]);
        },
      },
    });
  }, [setEdges, router]);

  // Clean up pending deletes on unmount
  useEffect(() => {
    return () => {
      for (const tid of pendingDeletesRef.current.values()) clearTimeout(tid);
    };
  }, []);

  // Edge disconnect-by-drag: drag an edge endpoint to empty canvas to delete it
  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(() => {
    edgeReconnectSuccessful.current = true;
  }, []);

  const onReconnectEnd = useCallback((_event: MouseEvent | TouchEvent, edge: Edge) => {
    if (edgeReconnectSuccessful.current) return;
    deleteRelationship(edge);
  }, [deleteRelationship]);

  // Focus on person when focusPersonId is provided (e.g. from /tree?focus=...)
  // focusKey allows re-triggering the effect for the same person (e.g. tapping same family member)
  useEffect(() => {
    if (!focusPersonId) return;
    // Small delay to let React Flow render nodes first
    const timer = setTimeout(() => {
      fitView({ nodes: [{ id: focusPersonId }], duration: 500, padding: 0.5 });
      // On mobile, the parent already set selectedPerson via handleFocusNode
      if (!isMobile) {
        const person = treeData.persons.find((p) => p.id === focusPersonId);
        if (person) onSelectPerson(person);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [focusPersonId, focusKey, fitView, treeData, isMobile]);

  // Apply filters, quality data, and nodeStyle in a single pass
  useEffect(() => {
    setNodes(nds => applyFilters(nds, filterState).map(node => {
      if (node.type !== 'person') return node;
      const q = qualityData.get(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          nodeStyle: effectiveNodeStyle,
          showGaps,
          qualityScore: q?.score ?? 0,
          missingFields: q?.missingFields ?? [],
        },
      };
    }));
  }, [filterState, showGaps, qualityData, effectiveNodeStyle, setNodes]);

  // Compute filtered edges (dimmed based on node dimmed status)
  const filteredEdges = useMemo(() => applyEdgeFilters(edges, nodes), [edges, nodes]);

  // Keyboard shortcuts
  useEffect(() => {
    if (isMobile) return; // No keyboard shortcuts on mobile
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectPerson(null);
        setContextMenu(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        setNodes(nds => nds.map(n => ({ ...n, selected: !n.data?.dimmed })));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setNodes, isMobile]);

  // Export helpers (for mobile toolbar slot)
  const getFlowElement = useCallback(() => {
    return document.querySelector('.react-flow__viewport') as HTMLElement | null;
  }, []);

  const exportPng = useCallback(async () => {
    const element = getFlowElement();
    if (!element) return;
    const nodes = getNodes();
    if (nodes.length === 0) { toast.error('No nodes to export'); return; }
    const { getNodesBounds, getViewportForBounds } = await import('@xyflow/react');
    const { toPng } = await import('html-to-image');
    const IMAGE_WIDTH = 4096;
    const IMAGE_HEIGHT = 3072;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim() || '#f8fafc';
    const bounds = getNodesBounds(nodes);
    const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: bg,
        width: IMAGE_WIDTH, height: IMAGE_HEIGHT,
        style: { width: `${IMAGE_WIDTH}px`, height: `${IMAGE_HEIGHT}px`, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
      });
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'ancstra-tree.png'; a.click();
      toast.success('PNG exported');
    } catch { toast.error('Export failed'); }
  }, [getFlowElement, getNodes]);

  const exportSvg = useCallback(async () => {
    const element = getFlowElement();
    if (!element) return;
    const nodes = getNodes();
    if (nodes.length === 0) { toast.error('No nodes to export'); return; }
    const { getNodesBounds, getViewportForBounds } = await import('@xyflow/react');
    const { toSvg } = await import('html-to-image');
    const IMAGE_WIDTH = 4096;
    const IMAGE_HEIGHT = 3072;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim() || '#f8fafc';
    const bounds = getNodesBounds(nodes);
    const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);
    try {
      const dataUrl = await toSvg(element, {
        backgroundColor: bg,
        width: IMAGE_WIDTH, height: IMAGE_HEIGHT,
        style: { width: `${IMAGE_WIDTH}px`, height: `${IMAGE_HEIGHT}px`, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
      });
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'ancstra-tree.svg'; a.click();
      toast.success('SVG exported');
    } catch { toast.error('Export failed'); }
  }, [getFlowElement, getNodes]);

  const exportPdf = useCallback(async () => {
    const element = getFlowElement();
    if (!element) return;
    const nodes = getNodes();
    if (nodes.length === 0) { toast.error('No nodes to export'); return; }
    const { getNodesBounds, getViewportForBounds } = await import('@xyflow/react');
    const { toPng } = await import('html-to-image');
    const IMAGE_WIDTH = 4096;
    const IMAGE_HEIGHT = 3072;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim() || '#f8fafc';
    const bounds = getNodesBounds(nodes);
    const viewport = getViewportForBounds(bounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0.1);
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: bg,
        width: IMAGE_WIDTH, height: IMAGE_HEIGHT,
        style: { width: `${IMAGE_WIDTH}px`, height: `${IMAGE_HEIGHT}px`, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
      });
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [IMAGE_WIDTH, IMAGE_HEIGHT] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
      pdf.save('ancstra-tree.pdf');
      toast.success('PDF exported');
    } catch { toast.error('Export failed'); }
  }, [getFlowElement, getNodes]);

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {isMobile ? mobileToolbarSlot?.({
        onAutoLayout: handleAutoLayout,
        onExportPng: exportPng,
        onExportSvg: exportSvg,
        onExportPdf: exportPdf,
      }) : (<TreeToolbar
        onAutoLayout={handleAutoLayout}
        onTogglePalette={onTogglePalette}
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
        showGaps={showGaps}
        onToggleGaps={() => setShowGaps(!showGaps)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(v => !v)}
        view={view}
        onSetView={onSetView}
        nodeStyle={nodeStyle}
        onNodeStyleChange={handleNodeStyleChange}
      />)}

      <div className="flex-1 relative overflow-hidden">
        <ReactFlow
          aria-label="Family tree"
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={filteredEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={isMobile ? undefined : onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeContextMenu={isMobile ? undefined : onNodeContextMenu}
          onEdgeContextMenu={isMobile ? undefined : onEdgeContextMenu}
          onPaneContextMenu={isMobile ? undefined : onPaneContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          isValidConnection={isMobile ? undefined : isValidConnection}
          onConnect={isMobile ? undefined : onConnect}
          onReconnectStart={isMobile ? undefined : onReconnectStart}
          onReconnect={isMobile ? undefined : onReconnect}
          onReconnectEnd={isMobile ? undefined : onReconnectEnd}
          edgesReconnectable={!isMobile}
          reconnectRadius={20}
          onDragOver={isMobile ? undefined : onDragOver}
          onDrop={isMobile ? undefined : onDrop}
          fitView
          onlyRenderVisibleElements
          minZoom={0.1}
          maxZoom={2}
          deleteKeyCode={isMobile ? null : "Delete"}
          selectionOnDrag={!isMobile}
          selectionMode={isMobile ? undefined : SelectionMode.Partial}
          multiSelectionKeyCode={isMobile ? null : "Shift"}
          nodesDraggable={!isMobile}
          nodesConnectable={!isMobile}
          zoomOnScroll={!isMobile}
          zoomOnDoubleClick={!isMobile}
          panOnDrag={!isMobile}
          panOnScroll={isMobile}
          zoomOnPinch
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          {(isMobile || showMinimap) && (
            <MiniMap
              position="top-right"
              zoomable={!isMobile}
              pannable
              className="!bg-card/70 !backdrop-blur-sm !border !border-border/50 !rounded-md !shadow-sm"
              style={isMobile ? { width: 80, height: 50 } : { width: 120, height: 75 }}
            />
          )}
          <Controls
            position="bottom-right"
            showZoom
            showFitView
            showInteractive={!isMobile}
            className={cn(
              "!bg-card !border !shadow-sm !rounded-lg",
              isMobile && isDetailOpen && "!mb-[38dvh]"
            )}
          />
        </ReactFlow>

        {!isMobile && contextMenu && (
          <TreeContextMenu
            {...contextMenu}
            persons={treeData.persons}
            onClose={() => setContextMenu(null)}
            onDeleteRelationship={(edgeId) => {
              const edge = edges.find(e => e.id === edgeId);
              if (edge) deleteRelationship(edge);
            }}
          />
        )}
      </div>
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
