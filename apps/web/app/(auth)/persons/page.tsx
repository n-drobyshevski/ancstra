import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';
import { getCachedPersonsList } from '@/lib/cache/person';
import { PersonsClient } from '@/components/persons/persons-client';

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1'));
  const pageSize = 20;

  const data = await getCachedPersonsList(
    authContext.dbFilename,
    page,
    pageSize,
    q,
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
          initialQuery={q ?? ''}
          initialPage={page}
          pageSize={pageSize}
        />
      </div>
    </PagePadding>
  );
}
