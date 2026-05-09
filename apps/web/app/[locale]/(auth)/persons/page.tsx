import { Suspense } from 'react';
import Link from 'next/link';
import type { SearchParams } from 'nuqs/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';
import { getCachedPersonsList, getCachedTreeYearBounds } from '@/lib/cache/person';
import { personsCache } from '@/lib/persons/search-params';
import type { Locale } from '@/i18n/routing';
import { PersonsSidebarClient } from '@/components/persons/persons-sidebar-client';
import { PersonsTableClient } from '@/components/persons/persons-table-client';
import { PersonsSidebarSkeleton } from '@/components/skeletons/persons-sidebar-skeleton';
import { PersonsTableSkeleton } from '@/components/skeletons/persons-table-skeleton';
import { RoleGate } from '@/components/auth/role-gate';

// Lightweight async shell — awaits locale + setRequestLocale before any
// `getTranslations` so the call resolves against the request locale rather
// than falling back to the default. The Suspense'd sidebar/table subtrees
// don't translate on the server (they hand off to client components that
// read from <NextIntlClientProvider>), so they don't need the dance.
export default async function PersonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('persons.page');
  return (
    <PagePadding>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <RoleGate permission="person:create">
            <Button asChild>
              <Link href="/persons/new">{t('addNewPerson')}</Link>
            </Button>
          </RoleGate>
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
