import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { Button } from '@/components/ui/button';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';
import { getCachedPersonsList } from '@/lib/cache/person';
import { PersonsClient } from '@/components/persons/persons-client';
import { personsCache } from '@/lib/persons/search-params';

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  const filters = await personsCache.parse(searchParams);

  const data = await getCachedPersonsList(
    authContext.dbFilename,
    filters.page,
    filters.size,
    filters.q || undefined,
  );

  return (
    <PagePadding>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">People</h1>
          <Button asChild>
            <Link href="/persons/new">Add New Person</Link>
          </Button>
        </div>

        <PersonsClient
          initialPersons={data.items}
          initialTotal={data.total}
          initialQuery={filters.q}
          initialPage={filters.page}
          pageSize={filters.size}
        />
      </div>
    </PagePadding>
  );
}
