import { cacheLife, cacheTag } from 'next/cache';
import {
  getThread,
  getThreadTimelinePage,
  getPersonsTouchedByThread,
  listThreads,
  type ListThreadsFilters,
  type ThreadStatus,
  type ThreadTimelineCursor,
} from '@ancstra/research';
import { getFamilyDb } from '@/lib/db';

/**
 * Server loaders for the /research/threads surface.
 *
 * Pattern (mirrors apps/web/lib/cache/factsheets.ts):
 *   - Page calls `requirePagePermission` to resolve the AuthContext.
 *   - Page passes `ctx.dbFilename` into a loader here.
 *   - The cached function takes `dbFilename` as a serializable argument so
 *     it becomes part of the cache key — different families get separate
 *     cache entries automatically.
 *
 * Tags align with the existing mutation routes' revalidateTag calls:
 *   - POST /threads, PATCH /threads/[id]            → 'threads-list'
 *   - PATCH /threads/[id], events POST, cascade     → `thread:${id}`
 *
 * Once these loaders are wired into the UI, those existing revalidateTag
 * calls become live (today they invalidate a cache nothing reads).
 */

// ---------------------------------------------------------------------------
// Thread list (filtered).
// Status is included in the cache key by virtue of being part of `filters`.
// ---------------------------------------------------------------------------
export async function getCachedThreadList(
  dbFilename: string,
  filters: ListThreadsFilters = {},
) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('threads-list');
  if (filters.status) cacheTag(`threads-list:status:${filters.status}`);

  const db = await getFamilyDb(dbFilename);
  return listThreads(db, filters);
}

// ---------------------------------------------------------------------------
// Active threads (status='active'). Convenience wrapper for the sidebar /
// quick-switcher path so callers don't have to know about the filter shape.
// ---------------------------------------------------------------------------
export async function getCachedActiveThreads(dbFilename: string) {
  return getCachedThreadList(dbFilename, { status: 'active' as ThreadStatus });
}

// ---------------------------------------------------------------------------
// Single thread + eventCount. Uncached existence check first so a transient
// null is never baked into the cache (feedback_use_cache_null.md).
// ---------------------------------------------------------------------------
export async function loadThread(dbFilename: string, id: string) {
  const db = await getFamilyDb(dbFilename);
  const exists = await getThread(db, id);
  if (!exists) return null;
  return getCachedThread(dbFilename, id);
}

async function getCachedThread(dbFilename: string, id: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag(`thread:${id}`);

  const db = await getFamilyDb(dbFilename);
  return getThread(db, id);
}

// ---------------------------------------------------------------------------
// First page of a thread's timeline (cursor-based). Subsequent pages are
// fetched uncached via the REST API on scroll — caching mid-stream pages
// would explode the cache key space for little gain.
// ---------------------------------------------------------------------------
export async function getCachedThreadEvents(
  dbFilename: string,
  id: string,
  limit: number = 50,
) {
  'use cache';
  cacheLife('dashboard');
  cacheTag(`thread:${id}`);

  const db = await getFamilyDb(dbFilename);
  return getThreadTimelinePage(db, id, { limit });
}

// Uncached variant for infinite-scroll pages past the first.
export async function loadThreadEventsPage(
  dbFilename: string,
  id: string,
  cursor: ThreadTimelineCursor | undefined,
  limit: number = 50,
) {
  const db = await getFamilyDb(dbFilename);
  return getThreadTimelinePage(db, id, { limit, cursor });
}

// ---------------------------------------------------------------------------
// Persons touched by a thread (bounded). Same `thread:${id}` tag so any
// mutation that touches the thread invalidates this too.
// ---------------------------------------------------------------------------
export async function getCachedThreadPersons(
  dbFilename: string,
  id: string,
  limit: number = 200,
) {
  'use cache';
  cacheLife('dashboard');
  cacheTag(`thread:${id}`);

  const db = await getFamilyDb(dbFilename);
  return getPersonsTouchedByThread(db, id, { limit });
}
