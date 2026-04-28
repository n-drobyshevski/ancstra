import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { getCachedTreeData, getCachedDefaultLayout } from '@/lib/cache/tree';
import { getCachedTreeTableRows } from '@/lib/cache/tree-table';
import { getCachedTreeYearBounds } from '@/lib/cache/person';
import { getAuthContext } from '@/lib/auth/context';
import { treeTableCache } from '@/lib/tree/search-params';
import { TreeCanvasSkeleton } from '@/components/skeletons/tree-canvas-skeleton';
import { TreeTableSkeleton } from '@/components/skeletons/tree-table-skeleton';

const TreePageClient = dynamic(
  () => import('@/components/tree/tree-page-client').then(m => m.TreePageClient),
  { loading: () => null }
);

// Static shell — no top-level awaits. Auth + view-specific data resolve
// inside the Suspense boundary so the page HTML can be prerendered and
// shipped from the edge while the canvas/table streams in.
export default function TreePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<ViewFallback searchParams={searchParams} />}>
      <TreePageContent searchParams={searchParams} />
    </Suspense>
  );
}

// Picks the right skeleton based on the requested view so the shell doesn't
// shift when data lands. Reads searchParams without awaiting any DB calls.
async function ViewFallback({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view = sp.view === 'table' ? 'table' : 'canvas';
  return view === 'table' ? <TreeTableSkeleton /> : <TreeCanvasSkeleton />;
}

async function TreePageContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view = sp.view === 'table' ? 'table' : 'canvas';
  const focus = typeof sp.focus === 'string' ? sp.focus : undefined;

  const authContext = await getAuthContext();
  if (!authContext) return null;

  if (view === 'table') {
    const filters = await treeTableCache.parse(searchParams);
    const [data, yearBounds] = await Promise.all([
      getCachedTreeTableRows(authContext.dbFilename, filters),
      getCachedTreeYearBounds(authContext.dbFilename),
    ]);
    const fetchedSoFar = (filters.page - 1) * filters.size + data.items.length;
    const hasMore = fetchedSoFar < data.total;

    if (data.total === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-lg font-medium">No persons in your tree yet</h2>
            <p className="text-sm text-muted-foreground">
              Add your first person to start building your family tree.
            </p>
            <Link
              href="/persons/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Add First Person
            </Link>
          </div>
        </div>
      );
    }

    return (
      <TreePageClient
        viewData={{
          kind: 'table',
          rows: data.items,
          total: data.total,
          relationships: data.relationships,
          hasMore,
          yearBounds,
        }}
        focusPersonId={focus}
      />
    );
  }

  const [treeData, defaultLayout] = await Promise.all([
    getCachedTreeData(authContext.dbFilename),
    getCachedDefaultLayout(authContext.dbFilename),
  ]);

  if (treeData.persons.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-medium">No persons in your tree yet</h2>
          <p className="text-sm text-muted-foreground">
            Add your first person to start building your family tree.
          </p>
          <Link
            href="/persons/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add First Person
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TreePageClient
      viewData={{ kind: 'canvas', treeData, defaultLayout }}
      focusPersonId={focus}
    />
  );
}
