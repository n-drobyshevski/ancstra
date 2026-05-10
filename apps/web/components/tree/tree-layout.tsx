'use client';

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useTransition,
} from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQueryStates } from 'nuqs';
import type { PersonListItem, TreeData } from '@ancstra/shared';
// Note: buildRelationships is no longer needed — table view receives
// server-precomputed relationships, and the canvas does not consume them.
import { PersonPalette } from './person-palette';
import { TreeDetailPanel } from './tree-detail-panel';
import { MobileDetailSheet } from './mobile-detail-sheet';
import { MobileViewBar } from './mobile-view-bar';
import { TreeTableToolbar } from './tree-table-toolbar';
import { TreeActiveFilters } from './tree-active-filters';
import { TreeSidebarClient } from './tree-sidebar-client';
import { useSeeOnTree } from './use-see-on-tree';
import { useSidebar } from '@/components/ui/sidebar';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LayoutGrid, Download } from 'lucide-react';
import { deriveLegacyFilterState } from './tree-utils';
import { computeAncestors, computeDescendants } from '@/lib/tree/topology';
import {
  treeTableParsers,
  type TreeDensity,
  type TreeSexValue,
  type TreeLivingValue,
  type TreeSortKey,
  type TreeSortDir,
  type TreeHidableColumn,
} from '@/lib/tree/search-params';
import {
  readSurnameHighlightStyle,
  writeSurnameHighlightStyle,
  type SurnameHighlightStyle,
} from '@/lib/tree/view-prefs-storage';
import { normalizeSurname } from '@/lib/tree/surname-highlight';
import type { TreePersonRow } from './tree-table-columns';
import type { TreeTableRelationships } from '@/lib/persons/query-tree-table-rows';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';
import type { DefaultTreeLayout } from '@/lib/cache/tree';
import type { ProposedRelationshipForCanvas } from '@/lib/queries';
import { personDetailCache } from '@/lib/tree/person-detail-cache';
import { useClientHydratedState } from '@/hooks/use-client-hydrated-state';

const DENSITY_STORAGE_KEY = 'tree-table-density';

function readStoredDensity(): TreeDensity | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return v === 'compact' || v === 'comfortable' || v === 'spacious' ? v : null;
}

const TreeCanvas = dynamic(
  () => import('./tree-canvas').then((m) => ({ default: m.TreeCanvas })),
  { ssr: false },
);

const TreeTable = dynamic(
  () => import('./tree-table').then((m) => ({ default: m.TreeTable })),
  { ssr: false },
);

export type TreeViewData =
  | {
      kind: 'canvas';
      treeData: TreeData;
      /** Server-preloaded default layout — eliminates the post-mount position
       *  flash. May be null if the user has no saved layouts yet. */
      defaultLayout: DefaultTreeLayout | null;
      /** Pending proposed relationships rendered as a toggleable overlay
       *  when `prefs.showProposals` is true. */
      proposedRelationships: ProposedRelationshipForCanvas[];
    }
  | {
      kind: 'table';
      rows: TreePersonRow[];
      total: number;
      relationships: TreeTableRelationships;
      hasMore: boolean;
      yearBounds: TreeYearBounds;
    };

interface TreeLayoutProps {
  viewData: TreeViewData;
  focusPersonId?: string;
}

export function TreeLayout({ viewData, focusPersonId }: TreeLayoutProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { open: sidebarOpen, setOpen: setSidebarOpen, isMobile: sidebarMobile } = useSidebar();

  const view = (searchParams.get('view') ?? 'canvas') as 'canvas' | 'table';
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null);
  // Vaul snap of the mobile detail sheet — lifted up from MobileDetailSheet
  // so TreeCanvas can key its Controls offset (zoom + fit-view) on the
  // current depth. Reset to peek (0.35) whenever the selection changes so
  // each new person opens at the same minimal depth.
  const [detailSnap, setDetailSnap] = useState<number | string | null>(0.35);
  // Reset to peek depth whenever the selected person changes — done in
  // render via prev-compare instead of useEffect to avoid the cascading
  // render the effect would cause.
  const [prevSelectedId, setPrevSelectedId] = useState<string | undefined>(
    selectedPerson?.id,
  );
  if (selectedPerson?.id !== prevSelectedId) {
    setPrevSelectedId(selectedPerson?.id);
    if (selectedPerson) setDetailSnap(0.35);
  }
  const [focusKey, setFocusKey] = useState(0);
  const [runtimeFocusId, setRuntimeFocusId] = useState<string | undefined>(undefined);

  // Preload the URL-focused person so the panel opens instantly when the tree settles.
  useEffect(() => {
    if (focusPersonId) void personDetailCache.prefetch(focusPersonId);
  }, [focusPersonId]);

  // Revalidate cached entries when the tab regains focus — covers cross-tab edits.
  useEffect(() => {
    const onFocus = () => personDetailCache.invalidateAll();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // URL-driven shared filter state (sex, living, search, sort, dir, hide).
  const [isFilterPending, startFiltersTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(treeTableParsers, {
    shallow: false, // server reads these to refetch the table page
    history: 'replace',
    startTransition: startFiltersTransition,
  });

  // Legacy FilterState shape (nested booleans) needed by MobileViewBar's
  // inline sex/living toggles. The canvas reads URL filter state directly via
  // useTreeTableFilters() and computes its own derivation; this one is for
  // the parent-level mobile view bar only.
  const filterState = useMemo(
    () => deriveLegacyFilterState({ sex: filters.sex, living: filters.living }),
    [filters.sex, filters.living],
  );

  // Density (localStorage; mobile defaults to compact post-mount).
  const [density, setDensity] = useClientHydratedState<TreeDensity>(
    'comfortable',
    () => {
      const stored = readStoredDensity();
      if (stored) return stored;
      if (window.matchMedia('(max-width: 767px)').matches) return 'compact';
      return 'comfortable';
    },
  );

  const handleDensityChange = useCallback((next: TreeDensity) => {
    setDensity(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    }
  }, [setDensity]);

  const [showGaps, setShowGaps] = useState(false);

  // Surname-branch highlight state.
  // - Active surname lives in the URL (shareable, history-friendly) — empty
  //   string means "no highlight".
  // - Apply-as preference (overlay vs replace) is a long-lived UI choice and
  //   lives in localStorage. Hydration-safe pattern: start with `'overlay'`
  //   on the server render, then sync from storage post-mount.
  // `highlightSurname` parser has `withDefault('')`, but the actual nuqs
  // runtime briefly returns undefined under Turbopack HMR after sibling
  // hooks re-bind to the same parsers. Guarding here keeps the page from
  // crashing while keeping the typed contract elsewhere.
  const rawHighlightSurname = filters.highlightSurname ?? '';
  const activeHighlightSurname = rawHighlightSurname.trim()
    ? normalizeSurname(rawHighlightSurname)
    : null;
  const [surnameHighlightStyle, setSurnameHighlightStyleState] =
    useClientHydratedState<SurnameHighlightStyle>(
      'overlay',
      () => readSurnameHighlightStyle() ?? 'overlay',
    );
  const handleSurnameHighlightStyleChange = useCallback(
    (next: SurnameHighlightStyle) => {
      setSurnameHighlightStyleState(next);
      writeSurnameHighlightStyle(next);
    },
    [setSurnameHighlightStyleState],
  );
  const handleHighlightSurnameChange = useCallback(
    (next: string | null) => {
      const normalized = next ? normalizeSurname(next) : '';
      void setFilters({ highlightSurname: normalized, page: 1 });
    },
    [setFilters],
  );

  // Topology lifted to URL (phase 2): the server uses the anchor + mode to
  // restrict the table page via the closure table; the canvas reads the same
  // params and computes locally for snappiness.
  const topologyMode = filters.topologyMode;
  const setTopologyMode = useCallback(
    (mode: 'all' | 'ancestors' | 'descendants') => {
      void setFilters({
        topologyMode: mode,
        topologyAnchor:
          mode === 'all' ? '' : (filters.topologyAnchor || selectedPerson?.id || ''),
        page: 1,
      });
    },
    [setFilters, filters.topologyAnchor, selectedPerson],
  );
  const topologyReferenceId = filters.topologyAnchor || null;

  // Topology only applies to canvas in phase 1 (table view is server-paginated
  // and topology pushdown is phase 2). In table mode topologyVisibleIds is
  // always null.
  const topologyVisibleIds = useMemo<Set<string> | null>(() => {
    if (viewData.kind !== 'canvas') return null;
    if (topologyMode === 'all' || !topologyReferenceId) return null;
    const result =
      topologyMode === 'ancestors'
        ? computeAncestors(topologyReferenceId, viewData.treeData)
        : computeDescendants(topologyReferenceId, viewData.treeData, {
            includeCoParents: true,
          });
    result.add(topologyReferenceId);
    return result;
  }, [topologyMode, topologyReferenceId, viewData]);

  const topologyReferenceName = useMemo(() => {
    if (!topologyReferenceId) return null;
    if (viewData.kind === 'canvas') {
      const person = viewData.treeData.persons.find((p) => p.id === topologyReferenceId);
      return person ? `${person.givenName} ${person.surname}` : null;
    }
    const person = viewData.rows.find((p) => p.id === topologyReferenceId);
    return person ? `${person.givenName} ${person.surname}` : null;
  }, [topologyReferenceId, viewData]);

  // Auto-clear topology when the anchor person no longer exists in the
  // canvas data — covers two cases: user deleted the anchor, or arrived
  // with a stale URL (e.g., bookmark to /tree?topologyAnchor=<deleted-id>).
  // Without this, computeAncestors/computeDescendants on a missing id
  // returns an empty set and the canvas hides every person — blank
  // tree with no recovery path except manually clearing via the toolbar.
  // Silent reset (no toast) — if the user just deleted the anchor, the
  // existing "Person deleted" toast covers communication. Only canvas
  // mode is authoritative for absence (table mode is server-paginated
  // and the row may simply be off the current page).
  useEffect(() => {
    if (viewData.kind !== 'canvas') return;
    if (topologyMode === 'all' || !topologyReferenceId) return;
    const exists = viewData.treeData.persons.some(
      (p) => p.id === topologyReferenceId,
    );
    if (!exists) {
      void setFilters({ topologyMode: 'all', topologyAnchor: '', page: 1 });
    }
  }, [viewData, topologyMode, topologyReferenceId, setFilters]);

  const setView = useCallback(
    (v: 'canvas' | 'table') => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', v);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const seeOnTree = useSeeOnTree();

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
        void setFilters({ sex: nextVisible.length === all.length ? [] : nextVisible, page: 1 });
      } else {
        const all: TreeLivingValue[] = ['living', 'deceased'];
        const k = key as TreeLivingValue;
        const baseVisible = filters.living.length === 0 ? all : filters.living;
        const isVisible = baseVisible.includes(k);
        const nextVisible = isVisible
          ? baseVisible.filter((v) => v !== k)
          : [...baseVisible, k];
        void setFilters({ living: nextVisible.length === all.length ? [] : nextVisible, page: 1 });
      }
    },
    [filters.sex, filters.living, setFilters],
  );

  const handleSortChange = useCallback(
    (sort: TreeSortKey, dir: TreeSortDir) => {
      void setFilters({ sort, dir, page: 1 });
    },
    [setFilters],
  );

  const handleHiddenColumnsChange = useCallback(
    (hide: TreeHidableColumn[]) => {
      void setFilters({ hide });
    },
    [setFilters],
  );

  const handleClearFilters = useCallback(() => {
    void setFilters({
      q: '',
      sex: [],
      living: [],
      topologyMode: 'all',
      topologyAnchor: '',
      validation: [],
      bornFrom: null,
      bornTo: null,
      diedFrom: null,
      diedTo: null,
      place: '',
      placeScope: 'birth',
      citations: 'any',
      hasProposals: false,
      complGte: null,
      page: 1,
    });
  }, [setFilters]);

  const handleClearSearch = useCallback(() => {
    void setFilters({ q: '', page: 1 });
  }, [setFilters]);

  const handleClearTopology = useCallback(() => {
    void setFilters({ topologyMode: 'all', topologyAnchor: '', page: 1 });
  }, [setFilters]);

  const handleToggleGaps = useCallback(() => {
    setShowGaps((v) => !v);
  }, []);

  const handleTogglePalette = useCallback(() => {
    setPaletteOpen((v) => !v);
  }, []);

  const handleSelectPerson = useCallback((person: PersonListItem | null) => {
    setSelectedPerson(person);
  }, []);

  const handleSelectPersonById = useCallback(
    (personId: string) => {
      if (viewData.kind === 'canvas') {
        const person = viewData.treeData.persons.find((p) => p.id === personId);
        if (person) setSelectedPerson(person);
      } else {
        const person = viewData.rows.find((p) => p.id === personId);
        if (person) setSelectedPerson(person);
      }
    },
    [viewData],
  );

  const handleSetTopologyAnchor = useCallback(
    (person: PersonListItem, mode: 'ancestors' | 'descendants' = 'ancestors') => {
      setSelectedPerson(person);
      void setFilters({
        topologyAnchor: person.id,
        topologyMode: mode,
        page: 1,
      });
    },
    [setFilters],
  );

  const handleFocusNode = useCallback(
    (personId: string) => {
      if (viewData.kind !== 'canvas') return;
      const person = viewData.treeData.persons.find((p) => p.id === personId);
      if (person) {
        setSelectedPerson(person);
        setRuntimeFocusId(personId);
        setFocusKey((k) => k + 1);
      }
    },
    [viewData],
  );

  // "View on tree" dispatcher. On canvas → runtime in-place focus (no URL push).
  // On table → URL push (server roundtrip). buildSeeOnTreeSearch clears the
  // topology anchor so the focused person is guaranteed visible.
  const handleSeeOnTree = useCallback(
    (personId: string) => {
      if (viewData.kind === 'canvas') {
        handleFocusNode(personId);
      } else {
        seeOnTree(personId);
      }
    },
    [viewData.kind, handleFocusNode, seeOnTree],
  );

  const clearSelection = useCallback(() => {
    setSelectedPerson(null);
  }, []);

  const dismissSidebar = useCallback(() => {
    if (sidebarOpen && !sidebarMobile) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen, sidebarMobile, setSidebarOpen]);

  // ---------------------------------------------------------------------------
  // Table-mode infinite scroll: accumulate pages keyed by id; reset whenever
  // the URL filter signature changes (anything other than `page`).
  // ---------------------------------------------------------------------------
  const filterSignature = useMemo(() => {
    if (viewData.kind !== 'table') return '';
    return JSON.stringify({
      q: filters.q,
      sex: filters.sex,
      living: filters.living,
      sort: filters.sort,
      dir: filters.dir,
      topologyMode: filters.topologyMode,
      topologyAnchor: filters.topologyAnchor,
      validation: filters.validation,
      bornFrom: filters.bornFrom,
      bornTo: filters.bornTo,
      diedFrom: filters.diedFrom,
      diedTo: filters.diedTo,
      place: filters.place,
      placeScope: filters.placeScope,
      citations: filters.citations,
      hasProposals: filters.hasProposals,
      complGte: filters.complGte,
    });
  }, [
    filters.q,
    filters.sex,
    filters.living,
    filters.sort,
    filters.dir,
    filters.topologyMode,
    filters.topologyAnchor,
    filters.validation,
    filters.bornFrom,
    filters.bornTo,
    filters.diedFrom,
    filters.diedTo,
    filters.place,
    filters.placeScope,
    filters.citations,
    filters.hasProposals,
    filters.complGte,
    viewData.kind,
  ]);

  const [accumulatedRows, setAccumulatedRows] = useState<TreePersonRow[]>(
    viewData.kind === 'table' ? viewData.rows : [],
  );
  const [accumulatedRels, setAccumulatedRels] = useState<TreeTableRelationships>(
    viewData.kind === 'table' ? viewData.relationships : { parents: {}, spouses: {} },
  );
  const lastFilterSigRef = useRef(filterSignature);

  useEffect(() => {
    if (viewData.kind !== 'table') return;
    const sigChanged = filterSignature !== lastFilterSigRef.current;
    lastFilterSigRef.current = filterSignature;
    if (sigChanged || filters.page === 1) {
      // Reset on filter change or first page. The setState calls here
      // intentionally synchronize local accumulator state with the upstream
      // URL-driven query result — this is the rule's documented "subscribe
      // to external state" case (the URL/server is the source of truth).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccumulatedRows(viewData.rows);
      setAccumulatedRels(viewData.relationships);
      return;
    }
    // Append unique rows for subsequent pages.
    setAccumulatedRows((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      const next = [...prev];
      for (const row of viewData.rows) {
        if (!seen.has(row.id)) next.push(row);
      }
      return next;
    });
    setAccumulatedRels((prev) => ({
      parents: { ...prev.parents, ...viewData.relationships.parents },
      spouses: { ...prev.spouses, ...viewData.relationships.spouses },
    }));
  }, [viewData, filterSignature, filters.page]);

  const handleLoadMore = useCallback(() => {
    if (viewData.kind !== 'table') return;
    if (!viewData.hasMore) return;
    if (isFilterPending) return;
    void setFilters({ page: filters.page + 1 });
  }, [viewData, filters.page, isFilterPending, setFilters]);

  // Detail-panel data shape: canvas mode passes the full graph; table mode
  // synthesizes a minimal "treeData-like" object so the panel still renders.
  const detailPanelTreeData: TreeData = useMemo(() => {
    if (viewData.kind === 'canvas') return viewData.treeData;
    return {
      persons: accumulatedRows,
      families: [],
      childLinks: [],
    };
  }, [viewData, accumulatedRows]);

  // Hide palette in table view
  const showPalette = paletteOpen && view === 'canvas' && viewData.kind === 'canvas';

  return (
    <div className="h-full min-w-0 overflow-hidden">
      {/* Desktop layout */}
      <div className="hidden h-full min-w-0 md:flex" onClick={dismissSidebar}>
        {showPalette && <PersonPalette onClose={() => setPaletteOpen(false)} />}

        {viewData.kind === 'canvas' ? (
          <TreeCanvas
            treeData={viewData.treeData}
            defaultLayout={viewData.defaultLayout}
            proposedRelationships={viewData.proposedRelationships}
            focusPersonId={runtimeFocusId ?? focusPersonId}
            focusKey={focusKey}
            paletteOpen={paletteOpen}
            onTogglePalette={handleTogglePalette}
            onSelectPerson={handleSelectPerson}
            view={view}
            onSetView={setView}
            isMobile={false}
            showGaps={showGaps}
            onShowGapsChange={setShowGaps}
            onFocusPerson={handleFocusNode}
            onSetTopologyAnchor={handleSetTopologyAnchor}
            topologyVisibleIds={topologyVisibleIds}
            activeHighlightSurname={activeHighlightSurname}
            onHighlightSurnameChange={handleHighlightSurnameChange}
            highlightStyle={surnameHighlightStyle}
            onHighlightStyleChange={handleSurnameHighlightStyleChange}
          />
        ) : (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <TreeTableToolbar
              view={view}
              onSetView={setView}
              showGaps={showGaps}
              onToggleGaps={handleToggleGaps}
              topologyMode={topologyMode}
              onTopologyModeChange={setTopologyMode}
              topologyReferenceName={topologyReferenceName}
              density={density}
              onDensityChange={handleDensityChange}
              hiddenColumns={filters.hide}
              onHiddenColumnsChange={handleHiddenColumnsChange}
            />
            <div className="flex flex-1 min-h-0 min-w-0">
              <TreeSidebarClient yearBounds={viewData.yearBounds} />
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <div
                  className={`flex-1 flex flex-col min-h-0 p-4 gap-3 ${
                    isFilterPending ? 'motion-safe:opacity-50 motion-safe:transition-opacity' : ''
                  }`}
                  aria-busy={isFilterPending}
                >
                  <TreeActiveFilters topologyReferenceName={topologyReferenceName} />
                  <div className="flex-1 min-h-0">
                    <TreeTable
                      rows={accumulatedRows}
                      total={viewData.total}
                      relationships={accumulatedRels}
                      onSelectPerson={handleSelectPersonById}
                      onSetTopologyAnchor={handleSetTopologyAnchor}
                      onSeeOnTree={handleSeeOnTree}
                      sort={filters.sort}
                      dir={filters.dir}
                      onSortChange={handleSortChange}
                      density={density}
                      hiddenColumns={filters.hide}
                      onClearFilters={handleClearFilters}
                      isFiltered={
                        !!filters.q ||
                        filters.sex.length > 0 ||
                        filters.living.length > 0 ||
                        filters.topologyMode !== 'all' ||
                        filters.validation.length > 0 ||
                        filters.bornFrom !== null ||
                        filters.bornTo !== null ||
                        filters.diedFrom !== null ||
                        filters.diedTo !== null ||
                        filters.place.trim() !== '' ||
                        filters.citations !== 'any' ||
                        filters.hasProposals ||
                        filters.complGte !== null
                      }
                      selectedPersonId={selectedPerson?.id ?? null}
                      onLoadMore={handleLoadMore}
                      hasMore={viewData.hasMore}
                      isAppending={isFilterPending && filters.page > 1}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedPerson && (
          <TreeDetailPanel
            person={selectedPerson}
            treeData={detailPanelTreeData}
            onClose={clearSelection}
            onFocusNode={handleFocusNode}
            onSeeOnTree={handleSeeOnTree}
          />
        )}
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col md:hidden">
        {viewData.kind === 'canvas' ? (
          <>
            <TreeCanvas
              treeData={viewData.treeData}
              defaultLayout={viewData.defaultLayout}
              proposedRelationships={viewData.proposedRelationships}
              focusPersonId={runtimeFocusId ?? focusPersonId}
              focusKey={focusKey}
              paletteOpen={false}
              onTogglePalette={handleTogglePalette}
              onSelectPerson={handleSelectPerson}
              view={view}
              onSetView={setView}
              isMobile
              detailSnap={selectedPerson ? detailSnap : null}
              showGaps={showGaps}
              onShowGapsChange={setShowGaps}
              onFocusPerson={handleFocusNode}
              onSetTopologyAnchor={handleSetTopologyAnchor}
              topologyVisibleIds={topologyVisibleIds}
              activeHighlightSurname={activeHighlightSurname}
              onHighlightSurnameChange={handleHighlightSurnameChange}
              highlightStyle={surnameHighlightStyle}
              onHighlightStyleChange={handleSurnameHighlightStyleChange}
              mobileToolbarSlot={(canvasActions) => (
                <MobileViewBar
                  view={view}
                  onSetView={setView}
                  filterState={filterState}
                  onToggleFilter={handleToggleFilter}
                  showGaps={showGaps}
                  onToggleGaps={handleToggleGaps}
                  topologyMode={topologyMode}
                  onTopologyModeChange={setTopologyMode}
                  topologyReferenceName={topologyReferenceName}
                  density={density}
                  onDensityChange={handleDensityChange}
                  extraMenuItems={
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={canvasActions.onAutoLayout}>
                        <LayoutGrid className="mr-2 size-4" />
                        Auto Layout
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={canvasActions.onExportPng}>
                        <Download className="mr-2 size-4" />
                        Export PNG
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={canvasActions.onExportSvg}>
                        <Download className="mr-2 size-4" />
                        Export SVG
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={canvasActions.onExportPdf}>
                        <Download className="mr-2 size-4" />
                        Export PDF
                      </DropdownMenuItem>
                    </>
                  }
                />
              )}
            />
          </>
        ) : (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <MobileViewBar
              view={view}
              onSetView={setView}
              filterState={filterState}
              onToggleFilter={handleToggleFilter}
              showGaps={showGaps}
              onToggleGaps={handleToggleGaps}
              topologyMode={topologyMode}
              onTopologyModeChange={setTopologyMode}
              topologyReferenceName={topologyReferenceName}
              density={density}
              onDensityChange={handleDensityChange}
              yearBounds={viewData.yearBounds}
            />
            <div
              className={`flex-1 flex flex-col min-h-0 p-3 gap-2 ${
                isFilterPending ? 'motion-safe:opacity-50 motion-safe:transition-opacity' : ''
              }`}
              aria-busy={isFilterPending}
            >
              <TreeActiveFilters topologyReferenceName={topologyReferenceName} />
              <div className="flex-1 min-h-0">
                <TreeTable
                  rows={accumulatedRows}
                  total={viewData.total}
                  relationships={accumulatedRels}
                  onSelectPerson={handleSelectPersonById}
                  onSetTopologyAnchor={handleSetTopologyAnchor}
                  onSeeOnTree={handleSeeOnTree}
                  sort={filters.sort}
                  dir={filters.dir}
                  onSortChange={handleSortChange}
                  density={density}
                  hiddenColumns={filters.hide}
                  onClearFilters={handleClearFilters}
                  isFiltered={
                    !!filters.q ||
                    filters.sex.length > 0 ||
                    filters.living.length > 0 ||
                    filters.topologyMode !== 'all' ||
                    filters.validation.length > 0 ||
                    filters.bornFrom !== null ||
                    filters.bornTo !== null ||
                    filters.diedFrom !== null ||
                    filters.diedTo !== null ||
                    filters.place.trim() !== '' ||
                    filters.citations !== 'any' ||
                    filters.hasProposals ||
                    filters.complGte !== null
                  }
                  selectedPersonId={selectedPerson?.id ?? null}
                  onLoadMore={handleLoadMore}
                  hasMore={viewData.hasMore}
                  isAppending={isFilterPending && filters.page > 1}
                />
              </div>
            </div>
          </div>
        )}
        <MobileDetailSheet
          person={sidebarMobile ? selectedPerson : null}
          treeData={detailPanelTreeData}
          onClose={clearSelection}
          onFocusNode={handleFocusNode}
          onSeeOnTree={handleSeeOnTree}
          snap={detailSnap}
          setSnap={setDetailSnap}
        />
      </div>

    </div>
  );
}
