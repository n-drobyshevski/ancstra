// apps/web/__tests__/tree/person-detail-cache.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PersonDetail } from '@ancstra/shared';

const mockAction = vi.fn();

vi.mock('@/app/actions/person-detail', () => ({
  fetchPersonDetailAction: (id: string) => mockAction(id),
}));

import {
  personDetailCache,
  STALE_MS,
  MAX_ENTRIES,
  __resetCacheForTests,
} from '../../lib/tree/person-detail-cache';

function makeDetail(id: string): PersonDetail {
  return {
    id,
    givenName: id,
    surname: 'Test',
    sex: 'U',
    isLiving: true,
    birthDate: null,
    deathDate: null,
    birthPlace: null,
    deathPlace: null,
    notes: null,
    events: [],
  } as PersonDetail;
}

beforeEach(() => {
  __resetCacheForTests();
  mockAction.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-28T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('personDetailCache', () => {
  it('dedupes concurrent in-flight fetches for the same id', async () => {
    let resolveAction!: (v: { detail: PersonDetail; citationCount: number }) => void;
    mockAction.mockImplementation(
      () => new Promise((res) => { resolveAction = res; }),
    );

    const p1 = personDetailCache.prefetch('a');
    const p2 = personDetailCache.prefetch('a');

    expect(mockAction).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);

    resolveAction({ detail: makeDetail('a'), citationCount: 0 });
    await p1;
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('returns synchronously without re-fetching on a fresh hit', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');
    expect(mockAction).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(STALE_MS - 1);
    await personDetailCache.prefetch('a');
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('refetches on a stale hit', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');
    vi.advanceTimersByTime(STALE_MS + 1);
    await personDetailCache.prefetch('a');
    expect(mockAction).toHaveBeenCalledTimes(2);
  });

  it('read returns null when no entry exists', () => {
    expect(personDetailCache.read('missing')).toBeNull();
  });

  it('read returns null while an entry is only in-flight', () => {
    mockAction.mockImplementation(() => new Promise(() => {}));
    void personDetailCache.prefetch('a');
    expect(personDetailCache.read('a')).toBeNull();
  });

  it('read flags staleness by age', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');
    expect(personDetailCache.read('a')?.isStale).toBe(false);
    vi.advanceTimersByTime(STALE_MS + 1);
    expect(personDetailCache.read('a')?.isStale).toBe(true);
  });

  it('invalidate(id) drops the entry; next prefetch refetches', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');
    personDetailCache.invalidate('a');
    expect(personDetailCache.read('a')).toBeNull();
    await personDetailCache.prefetch('a');
    expect(mockAction).toHaveBeenCalledTimes(2);
  });

  it('invalidate accepts an array of ids', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');
    await personDetailCache.prefetch('b');
    personDetailCache.invalidate(['a', 'b']);
    expect(personDetailCache.read('a')).toBeNull();
    expect(personDetailCache.read('b')).toBeNull();
  });

  it('invalidateAll marks resolved entries stale without dropping data', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');
    personDetailCache.invalidateAll();
    const read = personDetailCache.read('a');
    expect(read).not.toBeNull();
    expect(read!.isStale).toBe(true);
    expect(read!.entry.data?.id).toBe('a');
  });

  it('subscribe fires on resolved fetch and unsubscribe stops further calls', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    const listener = vi.fn();
    const unsub = personDetailCache.subscribe('a', listener);
    await personDetailCache.prefetch('a');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    vi.advanceTimersByTime(STALE_MS + 1);
    await personDetailCache.prefetch('a');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('LRU eviction drops the oldest entry by ts when over MAX_ENTRIES', async () => {
    mockAction.mockImplementation((id: string) =>
      Promise.resolve({ detail: makeDetail(id), citationCount: 0 }),
    );
    const baseMs = new Date('2026-04-28T00:00:00Z').getTime();
    for (let i = 0; i < MAX_ENTRIES; i++) {
      vi.setSystemTime(baseMs + i * 1000);
      await personDetailCache.prefetch(`p${i}`);
    }
    // Insert one more — should evict p0.
    vi.setSystemTime(baseMs + 3600 * 1000);
    await personDetailCache.prefetch('p999');
    expect(personDetailCache.read('p0')).toBeNull();
    expect(personDetailCache.read('p999')).not.toBeNull();
  });

  it('rejection clears the in-flight promise so the next prefetch retries (cold reject)', async () => {
    mockAction.mockRejectedValueOnce(new Error('boom'));
    await expect(personDetailCache.prefetch('a')).rejects.toThrow('boom');
    // After rejection, no readable entry; retry should fire a fresh fetch.
    expect(personDetailCache.read('a')).toBeNull();

    mockAction.mockResolvedValueOnce({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');
    expect(mockAction).toHaveBeenCalledTimes(2);
    expect(personDetailCache.read('a')?.entry.data?.id).toBe('a');
  });

  it('rejection during revalidation preserves prior stale data', async () => {
    // Seed with resolved data.
    mockAction.mockResolvedValueOnce({ detail: makeDetail('a'), citationCount: 7 });
    await personDetailCache.prefetch('a');

    // Cross the stale window, then reject the revalidation.
    vi.advanceTimersByTime(STALE_MS + 1);
    mockAction.mockRejectedValueOnce(new Error('flaky'));
    await expect(personDetailCache.prefetch('a')).rejects.toThrow('flaky');

    // Stale data must still be readable; isStale stays true.
    const read = personDetailCache.read('a');
    expect(read).not.toBeNull();
    expect(read!.entry.data?.id).toBe('a');
    expect(read!.entry.citationCount).toBe(7);
    expect(read!.isStale).toBe(true);
  });

  it('SWR: stale data is readable while a revalidation is in flight', async () => {
    mockAction.mockResolvedValueOnce({ detail: makeDetail('a'), citationCount: 1 });
    await personDetailCache.prefetch('a');

    vi.advanceTimersByTime(STALE_MS + 1);

    // Hold the revalidation open.
    let resolveRevalidation!: (v: { detail: PersonDetail; citationCount: number }) => void;
    mockAction.mockImplementationOnce(
      () => new Promise((res) => { resolveRevalidation = res; }),
    );
    const inflight = personDetailCache.prefetch('a');

    // While revalidation is pending, prior data is still readable and flagged stale.
    const midRead = personDetailCache.read('a');
    expect(midRead).not.toBeNull();
    expect(midRead!.entry.data?.id).toBe('a');
    expect(midRead!.entry.citationCount).toBe(1);
    expect(midRead!.isStale).toBe(true);

    // Settle the revalidation; new data swaps in.
    resolveRevalidation({ detail: makeDetail('a'), citationCount: 9 });
    await inflight;
    const finalRead = personDetailCache.read('a');
    expect(finalRead!.entry.citationCount).toBe(9);
    expect(finalRead!.isStale).toBe(false);
  });

  it('invalidateAll notifies subscribers so open panels can revalidate', async () => {
    mockAction.mockResolvedValue({ detail: makeDetail('a'), citationCount: 0 });
    await personDetailCache.prefetch('a');

    const listener = vi.fn();
    personDetailCache.subscribe('a', listener);

    personDetailCache.invalidateAll();
    expect(listener).toHaveBeenCalledTimes(1);

    // Calling again is a no-op (already stale).
    personDetailCache.invalidateAll();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('invalidate during in-flight prefetch prevents stale data from clobbering fresh data', async () => {
    let resolveStale!: (v: { detail: PersonDetail; citationCount: number }) => void;
    mockAction.mockImplementationOnce(
      () => new Promise((res) => { resolveStale = res; }),
    );

    // Start a prefetch that will be raced.
    const stalePromise = personDetailCache.prefetch('a');

    // Invalidate (e.g., user saved an edit) and start a fresh prefetch that resolves first.
    personDetailCache.invalidate('a');
    mockAction.mockResolvedValueOnce({ detail: makeDetail('a'), citationCount: 99 });
    await personDetailCache.prefetch('a');
    expect(personDetailCache.read('a')?.entry.citationCount).toBe(99);

    // Now resolve the original (stale) promise — must NOT overwrite the fresh data.
    resolveStale({ detail: makeDetail('a'), citationCount: 1 });
    await stalePromise;

    expect(personDetailCache.read('a')?.entry.citationCount).toBe(99);
  });
});
