'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { PersonListItem, TreeData } from '@ancstra/shared';
import { PersonPalette } from './person-palette';
import { TreeDetailPanel } from './tree-detail-panel';
import { MobileDetailSheet } from './mobile-detail-sheet';
import { MobileViewBar } from './mobile-view-bar';
import { TreeTableToolbar } from './tree-table-toolbar';
import { useSidebar } from '@/components/ui/sidebar';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { LayoutGrid, Download } from 'lucide-react';
import { DEFAULT_FILTERS, type FilterState } from './tree-utils';
import { computeAncestors, computeDescendants } from '@/lib/tree/topology';

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

  // Shared filter state — lifted from TreeCanvas so both views can use it
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTERS);
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

  const handleToggleFilter = useCallback((category: 'sex' | 'living', key: string) => {
    setFilterState((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key as keyof typeof prev[typeof category]],
      },
    }));
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
            onFilterStateChange={setFilterState}
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
            />
            <div className="flex-1 overflow-hidden">
              <TreeTableWrapper
                treeData={treeData}
                relationships={relationships}
                onSelectPerson={handleSelectPerson}
                filterState={filterState}
                topologyVisibleIds={topologyVisibleIds}
              />
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
              onFilterStateChange={setFilterState}
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
            />
            <div className="flex-1 overflow-hidden">
              <TreeTableWrapper
                treeData={treeData}
                relationships={relationships}
                onSelectPerson={handleSelectPerson}
                filterState={filterState}
                topologyVisibleIds={topologyVisibleIds}
              />
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
