'use client';

import { PersonsSidebar } from './persons-sidebar';
import { PersonsToolbar } from './persons-toolbar';
import { ActiveFilters } from './active-filters';
import { PersonsDataTable } from './persons-data-table';
import { usePersonsFilters } from './use-persons-filters';
import type { PersonListItem } from '@ancstra/shared';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

interface PersonsShellProps {
  initialPersons: PersonListItem[];
  initialTotal: number;
  yearBounds: TreeYearBounds;
}

export function PersonsShell({ initialPersons, initialTotal, yearBounds }: PersonsShellProps) {
  const { isPending } = usePersonsFilters();

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
        <PersonsToolbar yearBounds={yearBounds} />
        <ActiveFilters />
        <div id="persons-results" tabIndex={-1}>
          <PersonsDataTable data={initialPersons} total={initialTotal} />
        </div>
      </main>
    </div>
  );
}
