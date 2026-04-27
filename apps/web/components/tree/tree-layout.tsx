'use client';

import { useState, useCallback, useEffect, useMemo, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useQueryStates } from 'nuqs';
import type { PersonListItem, TreeData } from '@ancstra/shared';
import { PersonPalette } from './person-palette';
import { TreeDetailPanel } from './tree-detail-panel';
import { MobileDetailSheet } from './mobile-detail-sheet';
import { MobileViewBar } from './mobile-view-bar';
import { TreeTableToolbar } from './tree-table-toolbar';
import { TreeActiveFilters } from './tree-active-filters';
import { useSidebar } from '@/components/ui/sidebar';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LayoutGrid, Download } from 'lucide-react';
import { type FilterState } from './tree-utils';
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

const DENSITY_STORAGE_KEY = 'tree-table-density';

function deriveFilterState(
  sex: readonly TreeSexValue[],
  living: readonly TreeLivingValue[],
): FilterState {
  const sexAll = sex.length === 0;
  const livingAll = living.length === 0;
  return {
    sex: {
      M: sexAll || sex.includes('M'),
      F: sexAll || sex.includes('F'),
      U: sexAll || sex.includes('U'),
    },
    living: {
      living: livingAll || living.includes('living'),
      deceased: livingAll || living.includes('deceased'),
    },
  };
}

function readStoredDensity(): TreeDensity | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  return v === 'compact' || v === 'comfortable' || v === 'spacious' ? v : null;
}

const TreeCanvas = dynamic(
  () => import('./tree-canvas').then((m) => ({ default: m.TreeCanvas })),
  { ssr: false },
);

const TreeTableWrapper = dynamic(
  () => import('./tree-table-wrapper').then((m) => ({ default: m.TreeTableWrapper })),
  { ssr: false },
);

function buildRelationships(treeData: TreeData) {
  const parents: Record<string, { id: string; name: string }[]> = {};
  const spouses: Record<string, { id: string; name: string }[]> = {};
  const nameMap = new Map(treeData.persons.map((p) => [p.id, `${p.givenName} ${p.surname}`]));

  for (const child of treeData.childLinks) {
    const family = treeData.families.find((f) => f.id === child.familyId);
    if (!family) continue;
    if (!parents[child.personId]) parents[child.personId] = [];
    if (family.partner1Id && nameMap.has(family.partner1Id)) {
      parents[child.personId].push({ id: family.partner1Id, name: nameMap.get(family.partner1Id)! });
    }
    if (family.partner2Id && nameMap.has(family.partner2Id)) {
      parents[child.personId].push({ id: family.partner2Id, name: nameMap.get(family.partner2Id)! });
    }
  }

  for (const family of treeData.families) {
    if (!family.partner1Id || !family.partner2Id) continue;
    if (!nameMap.has(family.partner1Id) || !nameMap.has(family.partner2Id)) continue;
    if (!spouses[family.partner1Id]) spouses[family.partner1Id] = [];
    spouses[family.partner1Id].push({ id: family.partner2Id, name: nameMap.get(family.partner2Id)! });
    if (!spouses[family.partner2Id]) spouses[family.partner2Id] = [];
    spouses[family.partner2Id].push({ id: family.partner1Id, name: nameMap.get(family.partner1Id)! });
  }

  return { parents, spouses };
}

interface TreeLayoutProps {
  treeData: TreeData;
  focusPersonId?: string;
}

export function TreeLayout({ treeData, focusPersonId }: TreeLayoutProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { open: sidebarOpen, setOpen: setSidebarOpen, isMobile: sidebarMobile } = useSidebar();

  const view = (searchParams.get('view') ?? 'canvas') as 'canvas' | 'table';
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [runtimeFocusId, setRuntimeFocusId] = useState<string | undefined>(undefined);

  // URL-driven shared filter state (sex, living, search, sort, dir, hide).
  const [isFilterPending, startFiltersTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(treeTableParsers, {
    shallow: true,
    history: 'replace',
    startTransition: startFiltersTransition,
  });

  // FilterState shape (used by canvas + table) derived from URL.
  const filterState = useMemo(
    () => deriveFilterState(filters.sex, filters.living),
    [filters.sex, filters.living],
  );

  // Density (localStorage; mobile defaults to compact post-mount).
  const [density, setDensity] = useState<TreeDensity>('comfortable');
  useEffect(() => {
    const stored = readStoredDensity();
    if (stored) {
      setDensity(stored);
    } else if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setDensity('compact');
    }
  }, []);

  const handleDensityChange = useCallback((next: TreeDensity) => {
    setDensity(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    }
  }, []);

  const [showGaps, setShowGaps] = useState(false);
  const [topologyMode, setTopologyMode] = useState<'all' | 'ancestors' | 'descendants'>('all');

  const topologyReferenceId = selectedPerson?.id ?? null;

  const topologyVisibleIds = useMemo<Set<string> | null>(() => {
    if (topologyMode === 'all' || !topologyReferenceId) return null;
    const result =
      topologyMode === 'ancestors'
        ? computeAncestors(topologyReferenceId, treeData)
        : computeDescendants(topologyReferenceId, treeData);
    result.add(topologyReferenceId);
    return result;
  }, [topologyMode, topologyReferenceId, treeData]);

  const topologyReferenceName = useMemo(() => {
    if (!topologyReferenceId) return null;
    const person = treeData.persons.find((p) => p.id === topologyReferenceId);
    return person ? `${person.givenName} ${person.surname}` : null;
  }, [topologyReferenceId, treeData]);

  const setView = useCallback(
    (v: 'canvas' | 'table') => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', v);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

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
        void setFilters({ sex: nextVisible.length === all.length ? [] : nextVisible });
      } else {
        const all: TreeLivingValue[] = ['living', 'deceased'];
        const k = key as TreeLivingValue;
        const baseVisible = filters.living.length === 0 ? all : filters.living;
        const isVisible = baseVisible.includes(k);
        const nextVisible = isVisible
          ? baseVisible.filter((v) => v !== k)
          : [...baseVisible, k];
        void setFilters({ living: nextVisible.length === all.length ? [] : nextVisible });
      }
    },
    [filters.sex, filters.living, setFilters],
  );

  const handleSearchChange = useCallback(
    (next: string) => {
      void setFilters({ q: next });
    },
    [setFilters],
  );

  const handleSortChange = useCallback(
    (sort: TreeSortKey, dir: TreeSortDir) => {
      void setFilters({ sort, dir });
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
    void setFilters({ q: '', sex: [], living: [] });
    setTopologyMode('all');
  }, [setFilters]);

  const handleClearSearch = useCallback(() => {
    void setFilters({ q: '' });
  }, [setFilters]);

  const handleClearTopology = useCallback(() => {
    setTopologyMode('all');
  }, []);

  const handleToggleGaps = useCallback(() => {
    setShowGaps((v) => !v);
  }, []);

  const handleTogglePalette = useCallback(() => {
    setPaletteOpen((v) => !v);
  }, []);

  const handleSelectPerson = useCallback((person: PersonListItem | null) => {
    setSelectedPerson(person);
  }, []);

  const handleSetTopologyAnchor = useCallback((person: PersonListItem) => {
    setSelectedPerson(person);
    setTopologyMode('ancestors');
  }, []);

  const handleFilterStateChange = useCallback(
    (next: FilterState) => {
      const sex: TreeSexValue[] = [];
      if (next.sex.M) sex.push('M');
      if (next.sex.F) sex.push('F');
      if (next.sex.U) sex.push('U');
      const living: TreeLivingValue[] = [];
      if (next.living.living) living.push('living');
      if (next.living.deceased) living.push('deceased');
      void setFilters({
        sex: sex.length === 3 ? [] : sex,
        living: living.length === 2 ? [] : living,
      });
    },
    [setFilters],
  );

  const handleFocusNode = useCallback(
    (personId: string) => {
      const person = treeData.persons.find((p) => p.id === personId);
      if (person) {
        setSelectedPerson(person);
        setRuntimeFocusId(personId);
        setFocusKey(k => k + 1);
      }
    },
    [treeData],
  );

  const clearSelection = useCallback(() => {
    setSelectedPerson(null);
  }, []);

  const dismissSidebar = useCallback(() => {
    if (sidebarOpen && !sidebarMobile) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen, sidebarMobile, setSidebarOpen]);

  const relationships = useMemo(() => buildRelationships(treeData), [treeData]);

  // Hide palette in table view
  const showPalette = paletteOpen && view === 'canvas';

  return (
    <div className="h-full min-w-0 overflow-hidden">
      {/* Desktop layout */}
      <div className="hidden h-full min-w-0 md:flex" onClick={dismissSidebar}>
        {showPalette && <PersonPalette onClose={() => setPaletteOpen(false)} />}

        {view === 'canvas' ? (
          <TreeCanvas
            treeData={treeData}
            focusPersonId={focusPersonId}
            paletteOpen={paletteOpen}
            onTogglePalette={handleTogglePalette}
            onSelectPerson={handleSelectPerson}
            view={view}
            onSetView={setView}
            isMobile={false}
            filterState={filterState}
            onFilterStateChange={handleFilterStateChange}
            showGaps={showGaps}
            onShowGapsChange={setShowGaps}
          />
        ) : (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <TreeTableToolbar
              view={view}
              onSetView={setView}
              filterState={filterState}
              onToggleFilter={handleToggleFilter}
              showGaps={showGaps}
              onToggleGaps={handleToggleGaps}
              topologyMode={topologyMode}
              onTopologyModeChange={setTopologyMode}
              topologyReferenceName={topologyReferenceName}
              search={filters.q}
              onSearchChange={handleSearchChange}
              density={density}
              onDensityChange={handleDensityChange}
              hiddenColumns={filters.hide}
              onHiddenColumnsChange={handleHiddenColumnsChange}
            />
            <div
              className={`flex-1 flex flex-col min-h-0 p-4 gap-3 ${
                isFilterPending ? 'motion-safe:opacity-50 motion-safe:transition-opacity' : ''
              }`}
              aria-busy={isFilterPending}
            >
              <TreeActiveFilters
                filterState={filterState}
                search={filters.q}
                topologyMode={topologyMode}
                topologyReferenceName={topologyReferenceName}
                onClearSearch={handleClearSearch}
                onToggleFilter={handleToggleFilter}
                onClearTopology={handleClearTopology}
              />
              <div className="flex-1 min-h-0">
                <TreeTableWrapper
                  treeData={treeData}
                  relationships={relationships}
                  onSelectPerson={handleSelectPerson}
                  onSetTopologyAnchor={handleSetTopologyAnchor}
                  filterState={filterState}
                  topologyVisibleIds={topologyVisibleIds}
                  search={filters.q}
                  sort={filters.sort}
                  dir={filters.dir}
                  onSortChange={handleSortChange}
                  density={density}
                  hiddenColumns={filters.hide}
                  onClearFilters={handleClearFilters}
                  topologyMode={topologyMode}
                  selectedPersonId={selectedPerson?.id ?? null}
                />
              </div>
            </div>
          </div>
        )}

        {selectedPerson && (
          <TreeDetailPanel
            person={selectedPerson}
            treeData={treeData}
            onClose={clearSelection}
            onFocusNode={handleFocusNode}
          />
        )}
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col md:hidden">
        {view === 'canvas' ? (
          <>
            <TreeCanvas
              treeData={treeData}
              focusPersonId={runtimeFocusId ?? focusPersonId}
              focusKey={focusKey}
              paletteOpen={false}
              onTogglePalette={handleTogglePalette}
              onSelectPerson={handleSelectPerson}
              view={view}
              onSetView={setView}
              isMobile
              isDetailOpen={!!selectedPerson}
              filterState={filterState}
              onFilterStateChange={handleFilterStateChange}
              showGaps={showGaps}
              onShowGapsChange={setShowGaps}
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
            />
            <div
              className={`flex-1 flex flex-col min-h-0 p-3 gap-2 ${
                isFilterPending ? 'motion-safe:opacity-50 motion-safe:transition-opacity' : ''
              }`}
              aria-busy={isFilterPending}
            >
              <TreeActiveFilters
                filterState={filterState}
                search={filters.q}
                topologyMode={topologyMode}
                topologyReferenceName={topologyReferenceName}
                onClearSearch={handleClearSearch}
                onToggleFilter={handleToggleFilter}
                onClearTopology={handleClearTopology}
              />
              <div className="flex-1 min-h-0">
                <TreeTableWrapper
                  treeData={treeData}
                  relationships={relationships}
                  onSelectPerson={handleSelectPerson}
                  onSetTopologyAnchor={handleSetTopologyAnchor}
                  filterState={filterState}
                  topologyVisibleIds={topologyVisibleIds}
                  search={filters.q}
                  sort={filters.sort}
                  dir={filters.dir}
                  onSortChange={handleSortChange}
                  density={density}
                  hiddenColumns={filters.hide}
                  onClearFilters={handleClearFilters}
                  topologyMode={topologyMode}
                  selectedPersonId={selectedPerson?.id ?? null}
                />
              </div>
            </div>
          </div>
        )}
        <MobileDetailSheet
          person={sidebarMobile ? selectedPerson : null}
          treeData={treeData}
          onClose={clearSelection}
          onFocusNode={handleFocusNode}
        />
      </div>
    </div>
  );
}
