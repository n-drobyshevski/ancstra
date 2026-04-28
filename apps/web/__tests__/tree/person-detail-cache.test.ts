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
    for (let i = 0; i < MAX_ENTRIES; i++) {
      vi.setSystemTime(new Date(`2026-04-28T00:00:${String(i).padStart(2, '0')}Z`));
      await personDetailCache.prefetch(`p${i}`);
    }
    // Insert one more — should evict p0.
    vi.setSystemTime(new Date('2026-04-28T01:00:00Z'));
    await personDetailCache.prefetch('p999');
    expect(personDetailCache.read('p0')).toBeNull();
    expect(personDetailCache.read('p999')).not.toBeNull();
  });
});
