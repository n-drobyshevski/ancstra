'use client';

import { useEffect, useMemo, useRef } from 'react';
import { PersonsToolbar } from './persons-toolbar';
import { ActiveFilters } from './active-filters';
import { PersonsDataTable } from './persons-data-table';
import { SelectionBar } from './selection-bar';
import { useSelection } from './use-selection';
import { usePersonsFilters } from './use-persons-filters';
import type { PersonListItem } from '@ancstra/shared';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface PersonsTableClientProps {
  initialPersons: PersonListItem[];
  initialTotal: number;
  // Mobile-drawer trigger lives in this subtree but renders the same sidebar
  // facets, so we still need yearBounds here. Cached fetch — no second DB hit.
  yearBounds: TreeYearBounds;
}

export function PersonsTableClient({
  initialPersons,
  initialTotal,
  yearBounds,
}: PersonsTableClientProps) {
  const { isPending, filters } = usePersonsFilters();
  const { state: selection, toggleRow, togglePage, selectAllMatching, clear } = useSelection();
  const pageIds = useMemo(() => initialPersons.map((p) => p.id), [initialPersons]);

  // Clear selection whenever filters change (URL identity is the source of truth).
  const lastFiltersRef = useRef(JSON.stringify(filters));
  useEffect(() => {
    const next = JSON.stringify(filters);
    if (next !== lastFiltersRef.current) {
      lastFiltersRef.current = next;
      clear();
    }
  }, [filters, clear]);

  // Esc clears selection; Cmd/Ctrl+A inside the table region selects current page.
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
    <main
      className={`space-y-3 min-w-0 ${isPending ? 'motion-safe:opacity-50 motion-safe:transition-opacity' : ''}`}
      aria-busy={isPending}
    >
      <a
        href="#persons-results"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-1 focus:shadow"
      >
        Skip to results
      </a>
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
  );
}
