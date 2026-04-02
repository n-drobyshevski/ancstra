import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getActivity, addActivity, clearActivity } from '../../lib/research/activity';

// Mock localStorage
const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

describe('activity storage', () => {
  it('returns empty array when no activity', () => {
    expect(getActivity()).toEqual([]);
  });

  it('adds an activity entry with timestamp', () => {
    addActivity({ type: 'search', title: 'Maria Kowalski born 1885', resultCount: 14 });
    const entries = getActivity();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('search');
    expect(entries[0].title).toBe('Maria Kowalski born 1885');
    expect(entries[0].resultCount).toBe(14);
    expect(entries[0].timestamp).toBeTypeOf('number');
  });

  it('adds entries in reverse chronological order (newest first)', () => {
    addActivity({ type: 'search', title: 'First search' });
    addActivity({ type: 'scrape', title: 'Second scrape' });
    const entries = getActivity();
    expect(entries[0].title).toBe('Second scrape');
    expect(entries[1].title).toBe('First search');
  });

  it('prunes to 20 entries max', () => {
    for (let i = 0; i < 25; i++) {
      addActivity({ type: 'search', title: `Search ${i}` });
    }
    expect(getActivity()).toHaveLength(20);
    expect(getActivity()[0].title).toBe('Search 24');
  });

  it('clears all activity', () => {
    addActivity({ type: 'search', title: 'Test' });
    clearActivity();
    expect(getActivity()).toEqual([]);
  });

  it('stores itemId for scrape/paste types', () => {
    addActivity({ type: 'scrape', title: 'familysearch.org/ark:...', itemId: 'item-123' });
    const entries = getActivity();
    expect(entries[0].itemId).toBe('item-123');
  });

  it('handles corrupted localStorage gracefully', () => {
    storage.set('ancstra:research-activity', 'not-json');
    expect(getActivity()).toEqual([]);
  });
});
