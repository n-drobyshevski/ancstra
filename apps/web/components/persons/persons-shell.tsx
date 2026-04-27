'use client';

import { useEffect, useMemo, useRef } from 'react';
import { PersonsSidebar } from './persons-sidebar';
import { PersonsToolbar } from './persons-toolbar';
import { ActiveFilters } from './active-filters';
import { PersonsDataTable } from './persons-data-table';
import { SelectionBar } from './selection-bar';
import { useSelection } from './use-selection';
import { usePersonsFilters } from './use-persons-filters';
import type { PersonListItem } from '@ancstra/shared';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface PersonsShellProps {
  initialPersons: PersonListItem[];
  initialTotal: number;
  yearBounds: TreeYearBounds;
}

export function PersonsShell({ initialPersons, initialTotal, yearBounds }: PersonsShellProps) {
  const { isPending, filters } = usePersonsFilters();
  const { state: selection, toggleRow, togglePage, selectAllMatching, clear } = useSelection();
  const pageIds = useMemo(() => initialPersons.map((p) => p.id), [initialPersons]);

  // Q1: clear selection when filters change (track filters by JSON identity)
  const lastFiltersRef = useRef(JSON.stringify(filters));
  useEffect(() => {
    const next = JSON.stringify(filters);
    if (next !== lastFiltersRef.current) {
      lastFiltersRef.current = next;
      clear();
    }
  }, [filters, clear]);

  // Q2: keyboard shortcuts — Esc clears; Cmd/Ctrl+A on table focuses selects current page
  const tableRegionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selection.kind !== 'none') {
        clear();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        const target = tableRegionRef.current;
        if (target && target.contains(document.activeElement) && pageIds.length > 0) {
          e.preventDefault();
          togglePage(pageIds, false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection.kind, clear, pageIds, togglePage]);

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <a
        href="#persons-results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-1 focus:shadow"
      >
        Skip to results
      </a>
      <div className="hidden md:block">
        <div className="rounded-md border bg-card sticky top-4 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col">
          <PersonsSidebar yearBounds={yearBounds} />
        </div>
      </div>
      <main
        className={`space-y-3 min-w-0 ${isPending ? 'motion-safe:opacity-50 motion-safe:transition-opacity' : ''}`}
        aria-busy={isPending}
      >
        {selection.kind === 'none' ? (
          <PersonsToolbar yearBounds={yearBounds} />
        ) : (
          <SelectionBar
            selection={selection}
            pageIds={pageIds}
            total={initialTotal}
            filters={filters}
            onClear={clear}
          />
        )}
        <ActiveFilters />
        <div id="persons-results" tabIndex={-1} ref={tableRegionRef}>
          <PersonsDataTable
            data={initialPersons}
            total={initialTotal}
            selection={selection}
            onToggleRow={toggleRow}
            onTogglePage={togglePage}
            onSelectAllMatching={selectAllMatching}
            onClearSelection={clear}
          />
        </div>
      </main>
    </div>
  );
}
