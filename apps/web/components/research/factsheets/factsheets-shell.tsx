import { getAuthContext } from '@/lib/auth/context';
import {
  getCachedFactsheetsWithCounts,
  getCachedFactsheetLinks,
  getCachedFactsheetDetail,
} from '@/lib/cache/factsheets';
import { FactsheetsLayout } from './factsheets-layout';

interface FactsheetsShellProps {
  searchParams: Promise<{ fs?: string; view?: string }>;
}

// Server component: resolves auth and pre-fetches the three payloads the
// client layout needs for first paint. Each payload comes from a cached
// server function (`'use cache'` + cacheTag), so repeat visits are free
// and mutations fire `revalidateTag()` to invalidate.
//
// All three fetches run in parallel via Promise.all to maximise overlap.
export async function FactsheetsShell({ searchParams }: FactsheetsShellProps) {
  const [authContext, params] = await Promise.all([
    getAuthContext(),
    searchParams,
  ]);
  if (!authContext) return null;

  const { dbFilename } = authContext;
  const selectedId = params.fs;

  const [factsheets, links, detail] = await Promise.all([
    getCachedFactsheetsWithCounts(dbFilename),
    getCachedFactsheetLinks(dbFilename),
    selectedId ? getCachedFactsheetDetail(dbFilename, selectedId) : Promise.resolve(null),
  ]);

  return (
    <FactsheetsLayout
      initialFactsheets={factsheets}
      initialLinks={links}
      initialDetail={detail}
    />
  );
}
