import { Suspense } from 'react';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { Button } from '@/components/ui/button';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';
import { getCachedPersonsList, getCachedTreeYearBounds } from '@/lib/cache/person';
import { personsCache } from '@/lib/persons/search-params';
import { PersonsSidebarClient } from '@/components/persons/persons-sidebar-client';
import { PersonsTableClient } from '@/components/persons/persons-table-client';
import { PersonsSidebarSkeleton } from '@/components/skeletons/persons-sidebar-skeleton';
import { PersonsTableSkeleton } from '@/components/skeletons/persons-table-skeleton';

// Static shell — no top-level awaits. Heading paints instantly; sidebar and
// table stream independently behind their own Suspense boundaries.
export default function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <PagePadding>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">People</h1>
          <Button asChild>
            <Link href="/persons/new">Add New Person</Link>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <Suspense fallback={<PersonsSidebarSkeleton />}>
            <PersonsSidebarServer />
          </Suspense>
          <Suspense fallback={<PersonsTableSkeleton />}>
            <PersonsTableServer searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </PagePadding>
  );
}

async function PersonsSidebarServer() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const yearBounds = await getCachedTreeYearBounds(authContext.dbFilename);
  return <PersonsSidebarClient yearBounds={yearBounds} />;
}

async function PersonsTableServer({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const filters = await personsCache.parse(searchParams);
  // yearBounds is cached — second call is essentially free, but the table
  // subtree needs its own copy because the mobile filter drawer (rendered
  // inside the toolbar) shows the same sidebar facets.
  const [data, yearBounds] = await Promise.all([
    getCachedPersonsList(authContext.dbFilename, filters),
    getCachedTreeYearBounds(authContext.dbFilename),
  ]);
  return (
    <PersonsTableClient
      initialPersons={data.items}
      initialTotal={data.total}
      yearBounds={yearBounds}
    />
  );
}
