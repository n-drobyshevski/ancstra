import { Suspense } from 'react';
import { PagePadding } from '@/components/page-padding';
import { InboxSkeleton } from '@/components/inbox/inbox-skeleton';
import type { Locale } from '@/i18n/routing';
import {
  InboxPageSection,
  type InboxSearchParams,
} from './inbox-page-section';

interface InboxPageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<InboxSearchParams>;
}

/**
 * Sync wrapper around a Suspense'd async section. Next.js 16 cacheComponents
 * disallows top-level `await` / `async` on page default exports — the page
 * must stream chrome immediately and resolve the data inside a Suspense
 * boundary (see feedback_no_top_level_await_in_pages.md).
 */
export default function InboxPage({ params, searchParams }: InboxPageProps) {
  return (
    <PagePadding>
      <Suspense fallback={<InboxSkeleton />}>
        <ResolvedInboxSection paramsP={params} searchParamsP={searchParams} />
      </Suspense>
    </PagePadding>
  );
}

async function ResolvedInboxSection({
  paramsP,
  searchParamsP,
}: {
  paramsP: InboxPageProps['params'];
  searchParamsP: InboxPageProps['searchParams'];
}) {
  const [{ locale }, searchParams] = await Promise.all([paramsP, searchParamsP]);
  return <InboxPageSection locale={locale} searchParams={searchParams} />;
}
