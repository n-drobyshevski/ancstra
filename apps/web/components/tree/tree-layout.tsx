'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { PersonListItem, TreeData } from '@ancstra/shared';
import { PersonPalette } from './person-palette';
import { TreeDetailPanel } from './tree-detail-panel';
import { MobileDetailSheet } from './mobile-detail-sheet';
import { MobileTreeToolbar } from './mobile-tree-toolbar';

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

  const view = (searchParams.get('view') ?? 'canvas') as 'canvas' | 'table';
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonListItem | null>(null);

  const setView = useCallback(
    (v: 'canvas' | 'table') => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', v);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const handleTogglePalette = useCallback(() => {
    setPaletteOpen((v) => !v);
  }, []);

  const handleSelectPerson = useCallback((person: PersonListItem | null) => {
    setSelectedPerson(person);
  }, []);

  const handleFocusNode = useCallback(
    (personId: string) => {
      const person = treeData.persons.find((p) => p.id === personId);
      if (person) setSelectedPerson(person);
    },
    [treeData],
  );

  const clearSelection = useCallback(() => {
    setSelectedPerson(null);
  }, []);

  const relationships = useMemo(() => buildRelationships(treeData), [treeData]);

  // Hide palette in table view
  const showPalette = paletteOpen && view === 'canvas';

  return (
    <div className="h-full overflow-hidden rounded-lg border border-border">
      {/* Desktop layout */}
      <div className="hidden h-full md:flex">
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
          />
        ) : (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Table view gets same toolbar via TreeCanvas but we need a minimal toolbar */}
            <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
              <div className="flex items-center gap-1.5">
                <div className="flex overflow-hidden rounded-lg border border-border">
                  <button
                    onClick={() => setView('canvas')}
                    className="px-3 py-1 text-xs font-medium transition-colors text-muted-foreground hover:text-foreground"
                  >
                    Canvas
                  </button>
                  <button
                    onClick={() => setView('table')}
                    className="px-3 py-1 text-xs font-medium transition-colors bg-primary text-primary-foreground"
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <TreeTableWrapper treeData={treeData} relationships={relationships} />
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
              focusPersonId={focusPersonId}
              paletteOpen={false}
              onTogglePalette={handleTogglePalette}
              onSelectPerson={handleSelectPerson}
              view={view}
              onSetView={setView}
              isMobile
              mobileToolbarSlot={(toolbarProps) => (
                <MobileTreeToolbar {...toolbarProps} />
              )}
            />
            <MobileDetailSheet
              person={selectedPerson}
              treeData={treeData}
              onClose={clearSelection}
              onFocusNode={handleFocusNode}
            />
          </>
        ) : (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <MobileTreeToolbar
              filterState={{ sex: { M: true, F: true, U: true }, living: { living: true, deceased: true } }}
              onToggleFilter={() => {}}
              showGaps={false}
              onToggleGaps={() => {}}
              onAutoLayout={() => {}}
              onExportPng={() => {}}
              onExportSvg={() => {}}
              onExportPdf={() => {}}
            />
            <div className="flex-1 overflow-hidden">
              <TreeTableWrapper treeData={treeData} relationships={relationships} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
