// apps/web/lib/tree/person-detail-cache.ts
import type { PersonDetail } from '@ancstra/shared';
import { fetchPersonDetailAction } from '@/app/actions/person-detail';

export interface PersonDetailEntry {
  data: PersonDetail | null;
  citationCount: number;
  ts: number; // Date.now() of resolved fetch; 0 if forced-stale
}

interface InternalEntry extends Partial<PersonDetailEntry> {
  promise?: Promise<PersonDetailEntry>;
}

export const STALE_MS = 5 * 60_000;
export const MAX_ENTRIES = 200;

const store = new Map<string, InternalEntry>();
const listeners = new Map<string, Set<() => void>>();

function notify(id: string) {
  const set = listeners.get(id);
  if (!set) return;
  for (const fn of set) fn();
}

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  // Drop the oldest resolved entry by ts. In-flight (no ts) entries are exempt.
  let oldestId: string | null = null;
  let oldestTs = Infinity;
  for (const [id, entry] of store) {
    if (entry.ts === undefined) continue;
    if (entry.ts < oldestTs) {
      oldestTs = entry.ts;
      oldestId = id;
    }
  }
  if (oldestId) store.delete(oldestId);
}

async function doFetch(id: string): Promise<PersonDetailEntry> {
  const { detail, citationCount } = await fetchPersonDetailAction(id);
  const resolved: PersonDetailEntry = {
    data: detail ?? null,
    citationCount,
    ts: Date.now(),
  };
  // Replace in-flight entry with resolved data.
  store.set(id, { ...resolved });
  evictIfNeeded();
  notify(id);
  return resolved;
}

export const personDetailCache = {
  prefetch(id: string): Promise<PersonDetailEntry> {
    const existing = store.get(id);
    if (existing?.promise) return existing.promise;
    if (
      existing &&
      existing.ts !== undefined &&
      existing.ts > 0 &&
      Date.now() - existing.ts < STALE_MS
    ) {
      return Promise.resolve({
        data: existing.data ?? null,
        citationCount: existing.citationCount ?? 0,
        ts: existing.ts,
      });
    }
    const promise = doFetch(id);
    // Preserve any prior resolved data while the new fetch is in flight, so
    // subscribers can still read stale data.
    store.set(id, { ...(existing ?? {}), promise });
    return promise;
  },

  read(id: string): { entry: PersonDetailEntry; isStale: boolean } | null {
    const entry = store.get(id);
    if (!entry || entry.ts === undefined) return null;
    return {
      entry: {
        data: entry.data ?? null,
        citationCount: entry.citationCount ?? 0,
        ts: entry.ts,
      },
      isStale: entry.ts === 0 || Date.now() - entry.ts >= STALE_MS,
    };
  },

  invalidate(id: string | readonly string[]): void {
    const ids = Array.isArray(id) ? id : [id as string];
    for (const i of ids) store.delete(i);
  },

  invalidateAll(): void {
    for (const entry of store.values()) {
      if (entry.ts !== undefined) entry.ts = 0;
    }
  },

  subscribe(id: string, listener: () => void): () => void {
    let set = listeners.get(id);
    if (!set) {
      set = new Set();
      listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) listeners.delete(id);
    };
  },
};

// Test-only reset hook.
export function __resetCacheForTests() {
  store.clear();
  listeners.clear();
}
