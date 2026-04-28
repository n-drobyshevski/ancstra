'use client';

import { PersonsSidebar } from './persons-sidebar';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

// Thin client wrapper around the desktop sidebar. Lives in its own Suspense
// boundary so it streams independently of the table — filter state itself
// is URL-derived (nuqs), so no shared provider is needed across the split.
export function PersonsSidebarClient({ yearBounds }: { yearBounds: TreeYearBounds }) {
  return (
    <div className="hidden md:block">
      <div className="rounded-md border bg-card sticky top-4 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col">
        <PersonsSidebar yearBounds={yearBounds} />
      </div>
    </div>
  );
}
