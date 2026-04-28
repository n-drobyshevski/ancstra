'use client';

import { TreeSidebar } from './tree-sidebar';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

// Desktop-only wrapper for the tree-table sidebar. Filter state is URL-driven
// (nuqs) so this can live in its own subtree without prop-drilling state. The
// host gives it a card frame matching /persons.
export function TreeSidebarClient({ yearBounds }: { yearBounds: TreeYearBounds }) {
  return (
    <div className="hidden md:block w-64 shrink-0 p-4 pr-0">
      <div className="rounded-md border bg-card sticky top-4 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col">
        <TreeSidebar yearBounds={yearBounds} />
      </div>
    </div>
  );
}
