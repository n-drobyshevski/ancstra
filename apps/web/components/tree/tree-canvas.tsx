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
import { ProposedEdge } from './proposed-edge';
import { TreeToolbar } from './tree-toolbar';
import { TreeFiltersPanel } from './tree-filters-panel';
import { TreeContextMenu, type ContextMenuTrigger } from './tree-context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DraftPersonNode } from './draft-person-node';
import { DraftFactsheetNode } from './draft-factsheet-node';
import { PersonCreateDialog } from '@/components/person-create-dialog';
import { PersonLinkDialog, type RelationType } from '@/components/person-link-dialog';
import { personDetailCache } from '@/lib/tree/person-detail-cache';
import { useActiveThread } from '@/lib/research/active-thread';
import { useTreeOverlay } from '@/lib/research/tree-overlay';
import {
  treeDataToFlow,
  applyDagreLayout,
  applyPositionMap,
  extractPositions,
  relaxOverlapsByRank,
  rescaleSpacingByMode,
  validateConnection,
  parseLayoutData,
  serializeLayoutData,
  type NodeStyle,
  applyFilters,
  applyEdgeFilters,
  deriveLegacyFilterState,
} from './tree-utils';
import {
  useTreeTableFilters,
  useTreeFilterUpdate,
} from './use-tree-table-filters';
import type {
  TreeSexValue,
  TreeLivingValue,
} from '@/lib/tree/search-params';
import { trpc } from '@/lib/trpc/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQualityData } from '@/lib/tree/use-quality-data';
import { useConnectionLock } from '@/lib/graph/use-connection-lock';
import { classifyApiError } from '@/lib/api/classify-error';
import {
  readNodeStylePreference,
  writeNodeStylePreference,
} from '@/lib/tree/node-style-storage';
import { readShowDates, readShowLivingIndicator, readShowCitations } from '@/lib/tree/view-prefs-storage';
import type { DefaultTreeLayout } from '@/lib/cache/tree';
import type { ProposedRelationshipForCanvas } from '@/lib/queries';
import { useTreeViewPrefs } from '@/lib/tree/use-tree-view-prefs';
import { useTreeExport } from '@/lib/tree/use-tree-export';
import { computeColoringMap, SURNAME_TONE } from '@/lib/tree/coloring';
import { computeSurnameHighlightSet } from '@/lib/tree/surname-highlight';
import type { SurnameHighlightStyle } from '@/lib/tree/view-prefs-storage';

const nodeTypes = { person: PersonNode, draftPerson: DraftPersonNode, draftFactsheet: DraftFactsheetNode };
const edgeTypes = { partner: PartnerEdge, parentChild: ParentChildEdge, proposed: ProposedEdge };

/**
 * Tailwind class for the React Flow Controls margin, keyed off the active
 * Vaul snap of the mobile detail sheet. Returns an empty string when the
 * sheet is closed (no offset needed) or when running on desktop. The
 * literal class strings are kept inline so Tailwind's content scanner can
 * pre-generate them — don't switch to interpolation.
 */
function controlsOffsetClass(snap: number | string | null | undefined): string {
  if (snap === null || snap === undefined) return '';
  if (typeof snap !== 'number') return '!mb-[38dvh]';
  if (snap >= 0.7) return '!opacity-0 !pointer-events-none';
  if (snap >= 0.5) return '!mb-[63dvh]';
  return '!mb-[38dvh]';
}

interface TreeCanvasProps {
  treeData: TreeData;
  /** Server-preloaded default layout. When provided, the first render uses
   *  its saved positions instead of fresh dagre — eliminates the post-mount
   *  flash that would otherwise reorder all nodes ~300ms after mount. */
  defaultLayout?: DefaultTreeLayout | null;
  /** Pending proposed relationships. Rendered as ghost edges only when
   *  `prefs.showProposals` is true. Empty array if none. */
  proposedRelationships?: ProposedRelationshipForCanvas[];
  focusPersonId?: string;
  focusKey?: number;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  onSelectPerson: (person: PersonListItem | null) => void;
  view: 'canvas' | 'table';
  onSetView: (v: 'canvas' | 'table') => void;
  isMobile?: boolean;
  /** Active Vaul snap of the mobile detail sheet, or undefined when the
   *  sheet is closed. Drives the React Flow Controls offset so the zoom +
   *  fit-view buttons stay clear of the sheet at the peek and reading snaps,
   *  and disappear at the deepest snap. Vaul snaps are typed as
   *  `number | string` (string forms like "200px" are also legal); we treat
   *  string snaps as the peek default. */
  detailSnap?: number | string | null;
  showGaps?: boolean;
  onShowGapsChange?: (v: boolean) => void;
  mobileToolbarSlot?: (props: {
    onAutoLayout: () => void;
    onExportPng: () => void;
    onExportSvg: () => void;
    onExportPdf: () => void;
  }) => React.ReactNode;
  /** Imperative focus callback — used by the context menu's "Switch to person" toast action. */
  onFocusPerson?: (personId: string) => void;
  /** Pin a person as the topology anchor and switch the URL filter to
   *  ancestors-only or descendants-only. Wired to the right-click menu's
   *  "Show ancestors only" / "Show descendants only" items. */
  onSetTopologyAnchor?: (
    person: PersonListItem,
    mode: 'ancestors' | 'descendants',
  ) => void;
  /** Person ids visible under the active topology filter (anchor + mode).
   *  When `null` (or omitted), no topology filter applies — every person
   *  renders. When a Set is provided, person nodes whose id is not in the
   *  Set are hidden via xyflow's native `hidden` flag, along with any
   *  edge that touches a hidden endpoint. Drafts are unaffected. */
  topologyVisibleIds?: Set<string> | null;
  /** Currently active surname for the patrilineal-branch highlight feature
   *  (lowercase, normalized). `null` = feature off. Members of the active
   *  branch render with a spotlight tone (replace mode) or accent ring
   *  (overlay mode); non-members dim. */
  activeHighlightSurname?: string | null;
  /** Set/clear the active surname highlight. Wired to the toolbar popover
   *  AND to each PersonNode's right-click context menu. */
  onHighlightSurnameChange?: (surname: string | null) => void;
  /** How the surname highlight composes with the active Coloring mode. */
  highlightStyle?: SurnameHighlightStyle;
  onHighlightStyleChange?: (s: SurnameHighlightStyle) => void;
}

function TreeCanvasInner({ treeData, defaultLayout, proposedRelationships, focusPersonId, focusKey, paletteOpen, onTogglePalette, onSelectPerson, view, onSetView, isMobile, detailSnap, showGaps: externalShowGaps, onShowGapsChange: _onShowGapsChange, mobileToolbarSlot, onFocusPerson, onSetTopologyAnchor, topologyVisibleIds, activeHighlightSurname = null, onHighlightSurnameChange, highlightStyle = 'overlay', onHighlightStyleChange }: TreeCanvasProps) {
  void _onShowGapsChange;
  const reactFlow = useReactFlow();
  const { fitView, screenToFlowPosition, getNodes } = reactFlow;
  const router = useRouter();
  const connectionLock = useConnectionLock<'spouse' | 'parentChild'>({
    symmetricTypes: ['spouse'],
  });

  // Server-stored user preferences (tree layout behaviors). Read once and
  // cached by tRPC; defaults to "on" while the query is in-flight so the
  // first render applies the same ordering the user will see post-fetch.
  const { data: userPrefs } = trpc.userPreferences.get.useQuery(undefined, {
    staleTime: 60_000,
  });
  const genealogicalOrdering = userPrefs?.treeGenealogicalOrdering ?? true;

  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () => treeDataToFlow(treeData, { genealogicalOrdering }),
    [treeData, genealogicalOrdering],
  );

  // Read the user's preferred node style from localStorage once at mount so
  // the very first render reflects their choice. Mobile is always compact by
  // design (touch targets / horizontal density). For users with no preference
  // yet but a legacy nodeStyle on their server-preloaded layout, migrate it
  // synchronously so the first paint matches subsequent loads.
  const [initStyle] = useState<NodeStyle>(() => {
    if (isMobile) return 'compact';
    const stored = readNodeStylePreference();
    if (stored) return stored;
    if (defaultLayout) {
      const { nodeStyle: legacyStyle } = parseLayoutData(defaultLayout.layoutData);
      if (legacyStyle) {
        writeNodeStylePreference(legacyStyle);
        return legacyStyle;
      }
    }
    return 'wide';
  });
  // First render: dagre auto-layout for sane defaults, then overlay any saved
  // positions on top. Persons present in the tree but not in the saved layout
  // (e.g. recently added) keep their dagre-computed positions instead of
  // collapsing to (0,0).
  const initialNodes = useMemo(() => {
    const initShowDates = readShowDates() ?? true;
    const initShowLivingIndicator = readShowLivingIndicator() ?? true;
    const initShowCitations = readShowCitations() ?? false;
    const laid = applyDagreLayout(
      rawNodes,
      rawEdges,
      undefined,
      initStyle,
      { genealogicalOrdering },
    ).map((n) =>
      n.type === 'person'
        ? {
            ...n,
            data: {
              ...n.data,
              nodeStyle: initStyle,
              showDates: initShowDates,
              showLivingIndicator: initShowLivingIndicator,
              showCitations: initShowCitations,
            },
          }
        : n,
    );
    if (!defaultLayout) return laid;
    const { positions } = parseLayoutData(defaultLayout.layoutData);
    return applyPositionMap(laid, positions);
  }, [rawNodes, rawEdges, initStyle, defaultLayout, genealogicalOrdering]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  // Active research thread overlay: when a thread is set, persons it has
  // touched get a `threadOverlay: 'highlighted'`, others get `'dimmed'`.
  // Both states render in person-node.tsx via Tailwind classes.
  const { thread: activeThread } = useActiveThread();
  const { data: threadOverlayData } = useTreeOverlay(activeThread?.id ?? null);

  const [contextMenu, setContextMenu] = useState<ContextMenuTrigger | null>(
    null,
  );

  // Delete confirmation — drives the AlertDialog mount(s). We support two
  // shapes: single-person (driven by the right-click menu's "Delete person"
  // item) and bulk (driven by the multi-select menu's "Delete N people").
  const [deleteDialog, setDeleteDialog] = useState<
    | { kind: 'single'; personId: string; personName: string }
    | { kind: 'bulk'; personIds: string[] }
    | null
  >(null);

  // Add-relation dialog state — hoisted to canvas so it survives the context
  // menu unmounting. Driven by the menu's onAddRelation callback (or in the
  // future, by the detail panel / mobile sheet too).
  const [relationDialog, setRelationDialog] = useState<{
    kind: 'create' | 'link';
    relation: RelationType;
    target: { id: string; name: string; sex: 'M' | 'F' | 'U' };
  } | null>(null);

  // Layout management state
  const [layouts, setLayouts] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [activeLayoutName, setActiveLayoutName] = useState<string | null>(null);

  // URL-driven filter state (single source of truth; shared with table view).
  // The legacy nested-boolean shape is derived for the toolbar's inline
  // sex/living toggle buttons; the canvas's dim pipeline uses the URL filters
  // directly via applyFilters().
  const { filters } = useTreeTableFilters();
  const updateFilters = useTreeFilterUpdate();
  const filterState = useMemo(
    () => deriveLegacyFilterState(filters),
    [filters],
  );
  const prefs = useTreeViewPrefs();
  const { showMinimap } = prefs;
  // Canvas reads showGaps directly from prefs (localStorage). Parent's showGaps
  // prop is accepted (legacy) but ignored on canvas. Table view manages its own
  // showGaps via the parent state. v1 limitation: canvas/table toggles do not
  // sync across views.
  void externalShowGaps;
  const showGaps = prefs.showDataQuality;
  // nodeStyle preference is sourced from localStorage and seeded synchronously
  // so the initial render matches the user's last choice.
  const [nodeStyle, setNodeStyle] = useState<NodeStyle>(
    () => readNodeStylePreference() ?? 'wide',
  );
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
        const laid = applyDagreLayout(
          rawNodes,
          rawEdges,
          showGaps ? 82 : undefined,
          effectiveNodeStyle,
          { genealogicalOrdering },
        );
        return laid.map((n) => ({
          ...n,
          position: posMap[n.id] ?? n.position,
          data: {
            ...n.data,
            nodeStyle: effectiveNodeStyle,
            showDates: prefs.showDates,
            showLivingIndicator: prefs.showLivingIndicator,
            showCitations: prefs.showCitations,
          },
        }));
      });
      // Replace with server edges, keeping any optimistic edges not yet in server data
      setEdges((prev) => {
        const serverIds = new Set(rawEdges.map(e => e.id));
        const optimistic = prev.filter(e => !serverIds.has(e.id));
        return [...rawEdges, ...optimistic];
      });
    });
  }, [treeData, rawNodes, rawEdges, setNodes, setEdges, showGaps, effectiveNodeStyle, prefs.showDates, prefs.showLivingIndicator, prefs.showCitations, genealogicalOrdering]);

  // Toggle one key in either the sex or living facet, mirroring the URL-array
  // semantics from tree-layout's mobile bar: empty array OR full array means
  // "all selected" (no filter active).
  const handleToggleFilter = useCallback(
    (category: 'sex' | 'living', key: string) => {
      if (category === 'sex') {
        const all: TreeSexValue[] = ['M', 'F', 'U'];
        const k = key as TreeSexValue;
        const baseVisible = filters.sex.length === 0 ? all : filters.sex;
        const isVisible = baseVisible.includes(k);
        const nextVisible = isVisible
          ? baseVisible.filter((v) => v !== k)
          : [...baseVisible, k];
        updateFilters({
          sex: nextVisible.length === all.length ? [] : nextVisible,
        });
      } else {
        const all: TreeLivingValue[] = ['living', 'deceased'];
        const k = key as TreeLivingValue;
        const baseVisible =
          filters.living.length === 0 ? all : filters.living;
        const isVisible = baseVisible.includes(k);
        const nextVisible = isVisible
          ? baseVisible.filter((v) => v !== k)
          : [...baseVisible, k];
        updateFilters({
          living: nextVisible.length === all.length ? [] : nextVisible,
        });
      }
    },
    [filters.sex, filters.living, updateFilters],
  );

  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch the layouts LIST for the dropdown menu. The default layout's
  // positions are already applied via the server-preloaded `defaultLayout`
  // prop (see `initialNodes`) so there is no async re-positioning here.
  useEffect(() => {
    fetch('/api/layouts')
      .then((r) => r.json())
      .then((data) => {
        const list = data.layouts ?? [];
        setLayouts(list);
        if (defaultLayout) {
          setActiveLayoutId(defaultLayout.id);
          setActiveLayoutName(defaultLayout.name);
          return;
        }
        // No DB layout. Migrate any pre-API localStorage layout into the API.
        if (typeof window !== 'undefined' && localStorage.getItem('ancstra-tree-layout')) {
          const stored = localStorage.getItem('ancstra-tree-layout');
          if (stored) {
            const { positions } = parseLayoutData(stored);
            const positioned = applyPositionMap(rawNodes, positions);
            setNodes(positioned.map(n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: effectiveNodeStyle, showDates: prefs.showDates, showLivingIndicator: prefs.showLivingIndicator, showCitations: prefs.showCitations } } : n));
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
              body: JSON.stringify({ layoutData: serializeLayoutData(positions) }),
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
      if (person) onSelectPerson(person);
      setContextMenu(null);
    },
    [treeData, onSelectPerson],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // If the right-clicked node is part of a multi-selection, preserve the
      // whole selection so the multi-select menu surfaces. Otherwise reset
      // selection to just this node — the standard OS pattern, and ensures
      // any subsequent bulk action targets exactly what the user expects.
      const allNodes = reactFlow.getNodes();
      const currentSelection = allNodes.filter((n) => n.selected).map((n) => n.id);
      let selectionIds: string[];
      if (node.selected && currentSelection.length > 1) {
        selectionIds = currentSelection;
      } else {
        setNodes((nds) =>
          nds.map((n) => ({ ...n, selected: n.id === node.id })),
        );
        selectionIds = [node.id];
      }
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        surface: { kind: 'node', nodeId: node.id },
        selectionIds,
      });
    },
    [reactFlow, setNodes],
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        surface: {
          kind: 'edge',
          edgeId: edge.id,
          edgeType: edge.type as string,
          edgeFamilyId: (edge.data as { familyId?: string })?.familyId,
          edgeChildId: edge.type === 'parentChild' ? edge.target : undefined,
        },
        selectionIds: [],
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
        surface: { kind: 'pane' },
        selectionIds: [],
      });
    },
    [],
  );

  const onPaneClick = useCallback(() => setContextMenu(null), []);

  const handleAutoLayout = useCallback(() => {
    const laid = applyDagreLayout(
      rawNodes,
      rawEdges,
      showGaps ? 82 : undefined,
      effectiveNodeStyle,
      { genealogicalOrdering },
    );
    const newNodes = laid.map(n =>
      n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: effectiveNodeStyle, showDates: prefs.showDates, showLivingIndicator: prefs.showLivingIndicator, showCitations: prefs.showCitations } } : n,
    );
    setNodes(newNodes);

    // Persist immediately so the auto-layout survives navigation/reload.
    // setNodes is queued — extract from `newNodes` directly, not from state.
    const layoutData = serializeLayoutData(extractPositions(newNodes));

    if (activeLayoutId) {
      void fetch(`/api/layouts/${activeLayoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutData }),
      });
    } else {
      void fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Default', layoutData, isDefault: true }),
      })
        .then((r) => r.json())
        .then((layout: { id: string }) => {
          setActiveLayoutId(layout.id);
          setActiveLayoutName('Default');
          refreshLayouts();
        });
    }
  }, [rawNodes, rawEdges, setNodes, showGaps, effectiveNodeStyle, activeLayoutId, refreshLayouts, prefs.showDates, prefs.showLivingIndicator, prefs.showCitations, genealogicalOrdering]);

  const handleNodeStyleChange = useCallback((style: NodeStyle) => {
    // Capture the current mode BEFORE setNodeStyle commits — rescaling
    // needs both endpoints of the transition. effectiveNodeStyle accounts
    // for mobile (which always renders as compact regardless of pref).
    const prevStyle: NodeStyle = effectiveNodeStyle;
    setNodeStyle(style);
    writeNodeStylePreference(style);
    const autoSpreadEnabled = userPrefs?.treeAutoSpread ?? true;
    let nudgedNodes: Node[] = [];
    setNodes(nds => {
      const restyled = nds.map(n =>
        n.type === 'person'
          ? {
              ...n,
              data: {
                ...n.data,
                nodeStyle: style,
                showDates: prefs.showDates,
                showLivingIndicator: prefs.showLivingIndicator,
                showCitations: prefs.showCitations,
              },
            }
          : n,
      );
      // Two-pass spacing on mode switch:
      //   1. rescale — uniform scale around the global centroid by the
      //      ratio of expected sibling strides (170/320 going wide→compact,
      //      320/170 going compact→wide). Preserves the relative offset
      //      between every pair of nodes, so a parent stays aligned with
      //      its child and a singleton grandparent stays above its
      //      descendant.
      //   2. relax — pushes apart any post-scale overlaps. Pair stride
      //      and sibling stride scale at slightly different ratios (the
      //      pair ratio is ~0.514 vs sibling 0.531), so compact→wide can
      //      land partner gaps ~9px tighter than the partnerGap minimum;
      //      relax fixes that. Wide→compact leaves pair gaps ~5px wider
      //      than ideal which is visually imperceptible — no tighten pass
      //      needed (a tighten with re-centering would re-introduce the
      //      cross-rank misalignment we just spent rescale to avoid).
      const next = autoSpreadEnabled
        ? relaxOverlapsByRank(
            rescaleSpacingByMode(restyled, prevStyle, style),
            edges,
            style,
          )
        : restyled;
      nudgedNodes = next;
      return next;
    });
    // Persist the spread to the active saved layout so it survives reload.
    // Position-change events from setNodes don't fire React Flow's
    // `position` change type (it only fires on user drag), so the
    // debounced auto-save in handleNodesChange would miss this update.
    if (autoSpreadEnabled && activeLayoutId && nudgedNodes.length > 0) {
      const positions = extractPositions(nudgedNodes);
      void fetch(`/api/layouts/${activeLayoutId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutData: serializeLayoutData(positions) }),
      });
    }
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [setNodes, fitView, edges, activeLayoutId, userPrefs?.treeAutoSpread, prefs.showDates, prefs.showLivingIndicator, prefs.showCitations, effectiveNodeStyle]);

  const handleLoadLayout = useCallback(
    (id: string) => {
      fetch(`/api/layouts/${id}`)
        .then((r) => r.json())
        .then((layout) => {
          const { positions } = parseLayoutData(layout.layoutData);
          // Loading a saved layout applies its positions but does NOT change
          // the user's node-style preference — style is a separate per-browser
          // preference, not a property of the layout snapshot.
          const style = isMobile ? 'compact' : nodeStyle;
          const positioned = applyPositionMap(rawNodes, positions);
          setNodes(positioned.map(n => n.type === 'person' ? { ...n, data: { ...n.data, nodeStyle: style, showDates: prefs.showDates, showLivingIndicator: prefs.showLivingIndicator, showCitations: prefs.showCitations } } : n));
          setActiveLayoutId(layout.id);
          setActiveLayoutName(layout.name);
        });
    },
    [rawNodes, setNodes, isMobile, nodeStyle, prefs.showDates, prefs.showLivingIndicator, prefs.showCitations],
  );

  const handleSaveAsNew = useCallback(() => {
    const name = prompt('Layout name:');
    if (!name) return;
    setNodes((currentNodes) => {
      const positions = extractPositions(currentNodes);
      fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, layoutData: serializeLayoutData(positions) }),
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
        body: JSON.stringify({ layoutData: serializeLayoutData(positions) }),
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

  // Branch-coloring root tracks the *last* single-person selection on the
  // canvas — sticky semantics. Once the user has clicked a person, that
  // anchor persists across deselects and multi-selects until the next
  // single-click replaces it. Only the `length === 1` branch ever writes
  // here; deselects and multi-selects intentionally leave the anchor
  // untouched so paternal/maternal coloring stays stable while the user
  // explores. On initial mount with no selection ever made, this stays
  // `undefined` and the coloring falls back to URL `focusPersonId`.
  const [branchSelectedPersonId, setBranchSelectedPersonId] = useState<
    string | undefined
  >();

  const handleSelectionChange = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      const persons = params.nodes.filter((n) => n.type === 'person');
      if (persons.length === 1) {
        setBranchSelectedPersonId(persons[0].id);
      }
      // length === 0 (deselect) or > 1 (multi-select): keep the last
      // single-selection sticky. Do NOT clear.
    },
    [],
  );

  // Coloring: derived from prefs.coloring + (sticky single selection ??
  // focusPersonId) + treeData. Empty map for 'off' (and 'branch' without a
  // root). The selection-driven override only applies in 'branch' mode —
  // generation depth keeps its existing focus-anchored semantics.
  const branchColoringRoot =
    prefs.coloring === 'branch' && branchSelectedPersonId
      ? branchSelectedPersonId
      : focusPersonId;
  const coloringMap = useMemo(
    () => computeColoringMap(treeData, prefs.coloring, branchColoringRoot),
    [treeData, prefs.coloring, branchColoringRoot],
  );

  // Person ids that have at least one open AI proposal pointing at them.
  // Used to evaluate the canvas's "AI proposals open" filter against the
  // already-loaded proposed-relationship list (no extra fetch). When
  // `proposedRelationships` is undefined the set is empty and applyFilters
  // makes the dimension a silent no-op.
  const proposedPersonIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of proposedRelationships ?? []) {
      ids.add(p.person1Id);
      ids.add(p.person2Id);
    }
    return ids;
  }, [proposedRelationships]);

  // Apply filters, quality data, and nodeStyle in a single pass
  useEffect(() => {
    setNodes(nds => applyFilters(nds, filters, proposedPersonIds).map(node => {
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
          showDates: prefs.showDates,
          showLivingIndicator: prefs.showLivingIndicator,
          showCitations: prefs.showCitations,
        },
      };
    }));
  }, [filters, proposedPersonIds, showGaps, qualityData, effectiveNodeStyle, setNodes, prefs.showDates, prefs.showLivingIndicator, prefs.showCitations]);

  // Surname-branch highlight: compute the patrilineal-component membership
  // for the currently active surname. Empty set when no surname is active,
  // which makes the downstream decoration loop a cheap no-op.
  const surnameHighlightSet = useMemo(
    () => computeSurnameHighlightSet(treeData, activeHighlightSurname),
    [treeData, activeHighlightSurname],
  );
  const isSurnameHighlightActive = !!activeHighlightSurname;

  // Render-phase decoration: inject coloring fields onto every person node,
  // and apply the topology filter (Show ancestors only / Show descendants
  // only) by setting xyflow's native `hidden` on persons outside the visible
  // set. Drafts are intentionally never hidden — they're transient and
  // shouldn't disappear when the user pins a topology anchor. This keeps
  // tones + style stable across auto-layout, drag, and other state
  // mutations (mirrors the pattern used by `filteredEdges` below).
  const decoratedNodes = useMemo(
    () => nodes.map((n) => {
      if (n.type !== 'person') return n;
      const hiddenByTopology =
        topologyVisibleIds != null && !topologyVisibleIds.has(n.id);
      // Surname highlight axis. Three modes diverge here:
      // - overlay: matches get the accent ring (rendered in person-node);
      //   non-matches dim hard (opacity 0.3, click-blocked).
      // - replace: matches get the spotlight tone (overrides coloring);
      //   non-matches go neutral and dim.
      // - fadeOut: matches stay exactly as baseline (no ring, no tone
      //   change); non-matches are softly faded (grayscale + opacity 0.5,
      //   click-preserved). The "subtractive" mode.
      // When the feature is off, surnameHighlight stays undefined and the
      // node renders normally.
      let surnameHighlight: 'match' | 'nonmatch' | 'fadeNonmatch' | undefined;
      let coloringTone = coloringMap.get(n.id);
      if (isSurnameHighlightActive) {
        const isMatch = surnameHighlightSet.has(n.id);
        if (highlightStyle === 'fadeOut') {
          // Matches: leave everything baseline. Non-matches: mark for the
          // soft grayscale treatment in person-node.
          if (!isMatch) surnameHighlight = 'fadeNonmatch';
        } else if (isMatch) {
          surnameHighlight = 'match';
          if (highlightStyle === 'replace') {
            coloringTone = SURNAME_TONE;
          }
        } else {
          surnameHighlight = 'nonmatch';
          if (highlightStyle === 'replace') {
            // Replace mode: non-matches go neutral so the spotlight tone
            // is the only color on the canvas.
            coloringTone = undefined;
          }
        }
      }
      // Active-thread overlay axis. Independent of surname highlight — both
      // can be active simultaneously. When the overlay is null the field stays
      // undefined and person-node treats it as a no-op.
      let threadOverlay: 'highlighted' | 'dimmed' | undefined;
      if (threadOverlayData) {
        threadOverlay = threadOverlayData.touchedPersonIds.has(n.id)
          ? 'highlighted'
          : 'dimmed';
      }
      return {
        ...n,
        hidden: hiddenByTopology,
        data: {
          ...n.data,
          coloringTone,
          coloringStyle: prefs.coloringStyle,
          surnameHighlight,
          threadOverlay,
        },
      };
    }),
    [
      nodes,
      coloringMap,
      prefs.coloringStyle,
      topologyVisibleIds,
      surnameHighlightSet,
      isSurnameHighlightActive,
      highlightStyle,
      threadOverlayData,
    ],
  );

  // Compute filtered edges (dimmed based on node dimmed status), inject the
  // user's edge-path preference into parent-child edges, hide edges that
  // touch a topology-hidden endpoint, and append synthetic ghost edges for
  // pending proposals when the toggle is on.
  const filteredEdges = useMemo(() => {
    const dimmed = applyEdgeFilters(edges, nodes);
    const isTopologyHidden = (id: string) =>
      topologyVisibleIds != null && !topologyVisibleIds.has(id);
    const styled: Edge[] = dimmed.map((edge) => {
      const base =
        edge.type === 'parentChild'
          ? { ...edge, data: { ...edge.data, pathStyle: prefs.edges } }
          : edge;
      if (isTopologyHidden(edge.source) || isTopologyHidden(edge.target)) {
        return { ...base, hidden: true };
      }
      return base;
    });
    if (!prefs.showProposals || !proposedRelationships?.length) return styled;
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const p of proposedRelationships) {
      if (!nodeIds.has(p.person1Id) || !nodeIds.has(p.person2Id)) continue;
      const hidden =
        isTopologyHidden(p.person1Id) || isTopologyHidden(p.person2Id);
      styled.push({
        id: `proposed-${p.id}`,
        type: 'proposed',
        source: p.person1Id,
        target: p.person2Id,
        hidden,
        data: {
          relationshipType: p.relationshipType,
          sourceType: p.sourceType,
          confidence: p.confidence,
        },
      });
    }
    return styled;
  }, [edges, nodes, prefs.edges, prefs.showProposals, proposedRelationships, topologyVisibleIds]);

  // Export helpers (mobile toolbar slot consumes these; desktop uses
  // `<TreeExportMenu />` which calls the same hook).
  const { exportPng, exportSvg, exportPdf } = useTreeExport();

  // ---------------------------------------------------------------------------
  // Right-click menu action handlers
  // ---------------------------------------------------------------------------

  // Focus on a specific person — select them in the detail panel, pan and
  // zoom the camera to the node, and (if wired) bubble up to the parent so
  // branch-coloring re-roots and `runtimeFocusId` updates. Mirrors the
  // pattern used by the "Switch to person" success-toast action in
  // PersonCreate/LinkDialog. Used by the context menu's "Focus on person"
  // item.
  const handleFocusOnPerson = useCallback(
    (personId: string) => {
      const person = treeData.persons.find((p) => p.id === personId);
      if (person) onSelectPerson(person);
      reactFlow.fitView({
        nodes: [{ id: personId }],
        duration: 500,
        padding: 0.5,
      });
      onFocusPerson?.(personId);
    },
    [treeData, onSelectPerson, reactFlow, onFocusPerson],
  );

  // Single-person delete — runs after the AlertDialog confirm. Mirrors the
  // pre-rework behavior (DELETE /api/persons/{id}, invalidate detail cache,
  // refresh) but no longer calls window.confirm().
  const performDeletePerson = useCallback(
    async (personId: string) => {
      try {
        const res = await fetch(`/api/persons/${personId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          personDetailCache.invalidate(personId);
          toast.success('Person deleted');
          router.refresh();
        } else {
          toast.error(classifyApiError(res));
        }
      } catch {
        toast.error('Network error — check your connection');
      }
    },
    [router],
  );

  // Bulk delete — fires DELETE /api/persons/{id} for each selected id in
  // parallel. Toasts a single success/failure summary. Optimistic rollback
  // is intentionally not implemented (the page refresh after re-fetches the
  // canonical state).
  const performBulkDeletePersons = useCallback(
    async (personIds: string[]) => {
      const results = await Promise.allSettled(
        personIds.map((id) =>
          fetch(`/api/persons/${id}`, { method: 'DELETE' }).then(async (r) => {
            if (!r.ok) throw new Error(`status ${r.status}`);
            personDetailCache.invalidate(id);
            return id;
          }),
        ),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - ok;
      if (failed === 0) {
        toast.success(`${ok} ${ok === 1 ? 'person' : 'people'} deleted`);
      } else if (ok === 0) {
        toast.error(`Failed to delete ${failed} ${failed === 1 ? 'person' : 'people'}`);
      } else {
        toast.warning(`Deleted ${ok}; ${failed} failed`);
      }
      router.refresh();
    },
    [router],
  );

  const handleBulkExport = useCallback(
    (format: 'png' | 'svg' | 'pdf') => {
      const selectedIds = reactFlow
        .getNodes()
        .filter((n) => n.selected)
        .map((n) => n.id);
      const opts = { onlyIds: selectedIds };
      if (format === 'png') void exportPng(opts);
      else if (format === 'svg') void exportSvg(opts);
      else void exportPdf(opts);
    },
    [reactFlow, exportPng, exportSvg, exportPdf],
  );

  const handleSetTopologyAnchorFromMenu = useCallback(
    (person: PersonListItem, mode: 'ancestors' | 'descendants') => {
      onSetTopologyAnchor?.(person, mode);
    },
    [onSetTopologyAnchor],
  );

  const handleAddPersonFromMenu = useCallback(() => {
    router.push('/persons/new');
  }, [router]);

  const handleToggleMinimapFromMenu = useCallback(() => {
    prefs.setShowMinimap(!prefs.showMinimap);
  }, [prefs]);

  // Camera commands
  const handleFitToScreen = useCallback(() => {
    reactFlow.fitView({ padding: 0.2, duration: 250 });
  }, [reactFlow]);

  const handleCenterOnSelected = useCallback(() => {
    const selected = reactFlow.getNodes().find((n) => n.selected);
    if (!selected) return;
    // node.position is the top-left; add half-extent to land the node's center
    // at the viewport center.
    const w = selected.measured?.width ?? selected.width ?? 0;
    const h = selected.measured?.height ?? selected.height ?? 0;
    reactFlow.setCenter(
      selected.position.x + w / 2,
      selected.position.y + h / 2,
      { zoom: 1, duration: 250 },
    );
  }, [reactFlow]);

  const handleResetZoom = useCallback(() => {
    const { x, y } = reactFlow.getViewport();
    reactFlow.setViewport({ x, y, zoom: 1 }, { duration: 250 });
  }, [reactFlow]);

  // Keyboard shortcuts
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      // Existing shortcuts (unchanged behavior — fire even when typing).
      if (e.key === 'Escape') {
        onSelectPerson(null);
        setContextMenu(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setNodes((nds) =>
          nds.map((n) => {
            const hiddenByTopology =
              topologyVisibleIds != null &&
              n.type === 'person' &&
              !topologyVisibleIds.has(n.id);
            return {
              ...n,
              selected: !n.data?.dimmed && !hiddenByTopology,
            };
          }),
        );
        return;
      }

      // Guard new shortcuts only — don't intercept while typing in inputs.
      const target = e.target as HTMLElement | null;
      const inEditableField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (inEditableField) return;

      // Delete / Backspace — route to the AlertDialog confirm flow so the
      // server-side DELETE actually fires. xyflow's built-in deleteKeyCode
      // is disabled (set to null on the ReactFlow JSX) because it only
      // strips nodes from local state — no API call, so they reappear on
      // the next router.refresh. This handler reads xyflow's selection
      // via reactFlow.getNodes() (always-fresh, no stale closure) and
      // opens the same dialog the right-click menu's Delete person item
      // uses. Edge keyboard-delete is intentionally not handled here —
      // edges are deleted via right-click only (low-frequency action).
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        const selectedPersons = reactFlow
          .getNodes()
          .filter((n) => n.selected && n.type === 'person');
        if (selectedPersons.length === 0) return;
        e.preventDefault();
        if (selectedPersons.length === 1) {
          const id = selectedPersons[0].id;
          const p = treeData.persons.find((x) => x.id === id);
          const personName = p
            ? `${p.givenName} ${p.surname}`.trim() || '(unnamed)'
            : 'this person';
          setDeleteDialog({ kind: 'single', personId: id, personName });
        } else {
          setDeleteDialog({
            kind: 'bulk',
            personIds: selectedPersons.map((n) => n.id),
          });
        }
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // Mod+Alt+1 / Mod+Alt+2 — node style. Mod+1/Mod+2 conflict with
      // browser tab-switching (which most browsers claim before the page
      // can preventDefault), so we require Alt as a second modifier in
      // the Figma/Linear convention. Use `e.code === 'Digit1'` instead
      // of `e.key === '1'` because on macOS Option+1 reports `e.key === '¡'`.
      if (mod && !e.shiftKey && e.altKey && e.code === 'Digit1') {
        e.preventDefault();
        handleNodeStyleChange('wide');
        return;
      }
      if (mod && !e.shiftKey && e.altKey && e.code === 'Digit2') {
        e.preventDefault();
        handleNodeStyleChange('compact');
        return;
      }

      // Mod+M — toggle minimap
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        prefs.setShowMinimap(!prefs.showMinimap);
        return;
      }

      // Mod+G — toggle data quality
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        prefs.setShowDataQuality(!prefs.showDataQuality);
        return;
      }

      // Mod+Shift+L — auto layout
      if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleAutoLayout();
        return;
      }

      // F — fit to screen (no modifier)
      if (!mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFitToScreen();
        return;
      }

      // C — center on selected
      if (!mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCenterOnSelected();
        return;
      }

      // 0 — reset zoom
      if (!mod && !e.shiftKey && !e.altKey && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    setNodes,
    isMobile,
    onSelectPerson,
    setContextMenu,
    handleNodeStyleChange,
    prefs.showMinimap,
    prefs.setShowMinimap,
    prefs.showDataQuality,
    prefs.setShowDataQuality,
    handleAutoLayout,
    handleFitToScreen,
    handleCenterOnSelected,
    handleResetZoom,
    topologyVisibleIds,
    reactFlow,
    treeData,
    setDeleteDialog,
  ]);

  const hasSelection = reactFlow.getNodes().some((n) => n.selected);

  // Filter panel open/closed — local state, not persisted across sessions.
  // Lives here (rather than in TreeToolbar) so the panel can be mounted
  // inside the canvas viewport `<div className="flex-1 relative …">` while
  // the trigger remains in the toolbar.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Cmd/Ctrl + \ toggles the panel. This is Figma's universal sidebar
  // shortcut and the closest thing to a de-facto standard for canvas-style
  // editors. Cmd+\ is unbound by Chrome/Firefox/Safari at the browser level
  // so we don't fight the platform. Listener stays mounted for the lifetime
  // of the canvas so the shortcut works regardless of panel state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFiltersOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Escape closes the panel. Listener attaches only while open so we don't
  // intercept keystrokes for unrelated callers (e.g. the canvas's own
  // delete-key handling). Pointer-events on the closed panel are blocked
  // by the `inert` attribute set inside TreeFiltersPanel.
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  // Topology anchor display name for the active-filter chip strip in the
  // canvas filter panel. Mirrors the lookup tree-layout does for the table
  // view; computed locally here so the panel doesn't need a prop bridge.
  const topologyReferenceName = useMemo(() => {
    const id = filters.topologyAnchor;
    if (!id) return null;
    const person = treeData.persons.find((p) => p.id === id);
    return person ? `${person.givenName} ${person.surname}` : null;
  }, [filters.topologyAnchor, treeData]);

  // Year bounds for the canvas filter panel's born/died range sliders. The
  // canvas doesn't receive server-precomputed bounds (those are a table-mode
  // concern), so we derive a coarse range from the loaded persons. nulls
  // fall back to FALLBACK_BOUNDS inside the facet.
  const canvasYearBounds = useMemo(() => {
    let minYear: number | null = null;
    let maxYear: number | null = null;
    const consume = (date: string | null | undefined) => {
      if (!date) return;
      const m = date.match(/(\d{4})/);
      if (!m) return;
      const y = Number.parseInt(m[1], 10);
      minYear = minYear === null ? y : Math.min(minYear, y);
      maxYear = maxYear === null ? y : Math.max(maxYear, y);
    };
    for (const p of treeData.persons) {
      consume(p.birthDate);
      consume(p.deathDate);
    }
    return { minYear, maxYear };
  }, [treeData]);

  // (Bridge effect removed — `showGaps` now reads directly from `prefs.showDataQuality`.)

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {isMobile ? mobileToolbarSlot?.({
        onAutoLayout: handleAutoLayout,
        onExportPng: exportPng,
        onExportSvg: exportSvg,
        onExportPdf: exportPdf,
      }) : (<TreeToolbar
        onTogglePalette={onTogglePalette}
        paletteOpen={paletteOpen}
        view={view}
        onSetView={onSetView}
        filterState={filterState}
        onToggleFilter={handleToggleFilter}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        treeData={treeData}
        activeHighlightSurname={activeHighlightSurname}
        onHighlightSurnameChange={onHighlightSurnameChange ?? (() => {})}
        surnameHighlightStyle={highlightStyle}
        onSurnameHighlightStyleChange={onHighlightStyleChange ?? (() => {})}
        layouts={layouts}
        activeLayoutId={activeLayoutId}
        activeLayoutName={activeLayoutName}
        onLoadLayout={handleLoadLayout}
        onSaveAsNew={handleSaveAsNew}
        onUpdateLayout={handleUpdateLayout}
        onSetDefault={handleSetDefault}
        onDeleteLayout={handleDeleteLayout}
        onRenameLayout={handleRenameLayout}
        onAutoLayout={handleAutoLayout}
        nodeStyle={nodeStyle}
        onNodeStyleChange={handleNodeStyleChange}
        showDates={prefs.showDates}
        onShowDatesChange={prefs.setShowDates}
        showLivingIndicator={prefs.showLivingIndicator}
        onShowLivingIndicatorChange={prefs.setShowLivingIndicator}
        showMinimap={prefs.showMinimap}
        onShowMinimapChange={prefs.setShowMinimap}
        showDataQuality={prefs.showDataQuality}
        onShowDataQualityChange={prefs.setShowDataQuality}
        showProposals={prefs.showProposals}
        onShowProposalsChange={prefs.setShowProposals}
        showCitations={prefs.showCitations}
        onShowCitationsChange={prefs.setShowCitations}
        coloring={prefs.coloring}
        onColoringChange={prefs.setColoring}
        coloringStyle={prefs.coloringStyle}
        onColoringStyleChange={prefs.setColoringStyle}
        edges={prefs.edges}
        onEdgesChange={prefs.setEdges}
        onFitToScreen={handleFitToScreen}
        onCenterOnSelected={handleCenterOnSelected}
        onResetZoom={handleResetZoom}
        hasSelection={hasSelection}
      />)}

      {/* `overscroll-contain` traps pan gestures inside the canvas so Android
          Chrome doesn't fire pull-to-refresh when the user drags downward at
          the top of the tree. `touch-none` would also work but it disables
          native scroll on the wrapper itself; React Flow handles its own
          touch interaction so we leave it browser-default. */}
      <div className="flex-1 relative overflow-hidden overscroll-contain">
        <ReactFlow
          aria-label="Family tree"
          proOptions={{ hideAttribution: true }}
          nodes={decoratedNodes}
          edges={filteredEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={isMobile ? undefined : onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={onPaneClick}
          onSelectionChange={handleSelectionChange}
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
          deleteKeyCode={null}
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
              // Mobile-only: keep the zoom/fit cluster clear of the detail
              // sheet. The sheet snaps are 0.35 (peek) / 0.6 (reading) / 0.85
              // (full); we offset by ~the snap fraction so the cluster
              // floats just above the sheet edge, and hide it entirely at
              // the deepest snap where the sheet IS the interaction. String
              // snaps and unknown values fall back to the peek offset.
              isMobile && controlsOffsetClass(detailSnap)
            )}
          />
        </ReactFlow>

        <TreeContextMenu
          trigger={contextMenu}
          persons={treeData.persons}
          onClose={() => setContextMenu(null)}
          onAddRelation={(kind, relation, target) => {
            setRelationDialog({ kind, relation, target });
          }}
          onDeleteRelationship={(edgeId) => {
            const edge = edges.find((e) => e.id === edgeId);
            if (edge) deleteRelationship(edge);
          }}
          onRequestDeletePerson={(personId) => {
            const p = treeData.persons.find((x) => x.id === personId);
            const personName = p
              ? `${p.givenName} ${p.surname}`.trim() || '(unnamed)'
              : 'this person';
            setDeleteDialog({ kind: 'single', personId, personName });
            setContextMenu(null);
          }}
          onRequestBulkDelete={(personIds) => {
            setDeleteDialog({ kind: 'bulk', personIds });
            setContextMenu(null);
          }}
          onFocusOnPerson={handleFocusOnPerson}
          onSetTopologyAnchor={handleSetTopologyAnchorFromMenu}
          onFitView={handleFitToScreen}
          onResetZoom={handleResetZoom}
          onToggleMinimap={handleToggleMinimapFromMenu}
          onAddPerson={handleAddPersonFromMenu}
          onExportSelection={handleBulkExport}
          activeHighlightSurname={activeHighlightSurname}
          onHighlightSurnameChange={onHighlightSurnameChange}
        />

        <AlertDialog
          open={deleteDialog !== null}
          onOpenChange={(o) => {
            if (!o) setDeleteDialog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteDialog?.kind === 'bulk'
                  ? `Delete ${deleteDialog.personIds.length} people?`
                  : `Delete ${deleteDialog?.kind === 'single' ? deleteDialog.personName : 'person'}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the{' '}
                {deleteDialog?.kind === 'bulk' ? 'selected people' : 'person'}{' '}
                and any relationships connecting them. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteDialog?.kind === 'single') {
                    void performDeletePerson(deleteDialog.personId);
                  } else if (deleteDialog?.kind === 'bulk') {
                    void performBulkDeletePersons(deleteDialog.personIds);
                  }
                  setDeleteDialog(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {relationDialog?.kind === 'create' && (
          <PersonCreateDialog
            open
            onOpenChange={(open) => { if (!open) setRelationDialog(null); }}
            personId={relationDialog.target.id}
            personName={relationDialog.target.name}
            personSex={relationDialog.target.sex}
            relationType={relationDialog.relation}
            onCreated={() => {
              personDetailCache.invalidate(relationDialog.target.id);
              router.refresh();
              setRelationDialog(null);
            }}
            successAction={
              onFocusPerson
                ? { label: 'Switch to person', onClick: (newId) => onFocusPerson(newId) }
                : undefined
            }
          />
        )}
        {relationDialog?.kind === 'link' && (
          <PersonLinkDialog
            open
            onOpenChange={(open) => { if (!open) setRelationDialog(null); }}
            personId={relationDialog.target.id}
            personName={relationDialog.target.name}
            personSex={relationDialog.target.sex}
            relationType={relationDialog.relation}
            onLinked={() => {
              personDetailCache.invalidate(relationDialog.target.id);
              router.refresh();
              setRelationDialog(null);
            }}
            successAction={
              onFocusPerson
                ? { label: 'Switch to person', onClick: (linkedId) => onFocusPerson(linkedId) }
                : undefined
            }
          />
        )}

        {/* Filter panel — left-docked overlay inside the canvas viewport.
            Slides in from the left edge via translateX, no backdrop, doesn't
            block canvas interaction (Figma layers-panel pattern). The
            ReactFlow Controls live at bottom-right so they never overlap. */}
        {!isMobile && (
          <TreeFiltersPanel
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            yearBounds={canvasYearBounds}
            topologyReferenceName={topologyReferenceName}
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
