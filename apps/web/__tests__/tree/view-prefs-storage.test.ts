import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  readShowDates,
  writeShowDates,
  readShowLivingIndicator,
  writeShowLivingIndicator,
  readShowMinimap,
  writeShowMinimap,
  readShowDataQuality,
  writeShowDataQuality,
  readShowProposals,
  writeShowProposals,
  readShowCitations,
  writeShowCitations,
  readColoring,
  writeColoring,
  readEdgeStyle,
  writeEdgeStyle,
} from '../../lib/tree/view-prefs-storage';

const store: Record<string, string> = {};
const localStorageShim: Storage = {
  get length() {
    return Object.keys(store).length;
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  getItem: (k) => (k in store ? store[k] : null),
  key: (i) => Object.keys(store)[i] ?? null,
  removeItem: (k) => {
    delete store[k];
  },
  setItem: (k, v) => {
    store[k] = String(v);
  },
};

const originalWindow = (globalThis as { window?: unknown }).window;

(globalThis as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: localStorageShim,
};

afterAll(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

describe('view-prefs-storage', () => {
  beforeEach(() => {
    localStorageShim.clear();
  });

  // --- boolean prefs -------------------------------------------------------
  describe('boolean prefs return null when unset', () => {
    it.each([
      ['readShowDates', readShowDates],
      ['readShowLivingIndicator', readShowLivingIndicator],
      ['readShowMinimap', readShowMinimap],
      ['readShowDataQuality', readShowDataQuality],
      ['readShowProposals', readShowProposals],
      ['readShowCitations', readShowCitations],
    ])('%s returns null when nothing is stored', (_name, fn) => {
      expect(fn()).toBeNull();
    });
  });

  describe('boolean prefs roundtrip', () => {
    it('show-dates roundtrips true and false', () => {
      writeShowDates(true);
      expect(readShowDates()).toBe(true);
      writeShowDates(false);
      expect(readShowDates()).toBe(false);
    });

    it('show-living-indicator roundtrips', () => {
      writeShowLivingIndicator(true);
      expect(readShowLivingIndicator()).toBe(true);
    });

    it('show-minimap roundtrips', () => {
      writeShowMinimap(false);
      expect(readShowMinimap()).toBe(false);
    });

    it('show-data-quality roundtrips', () => {
      writeShowDataQuality(true);
      expect(readShowDataQuality()).toBe(true);
    });

    it('show-proposals roundtrips', () => {
      writeShowProposals(true);
      expect(readShowProposals()).toBe(true);
    });

    it('show-citations roundtrips', () => {
      writeShowCitations(true);
      expect(readShowCitations()).toBe(true);
    });
  });

  it('boolean reads return null for malformed values', () => {
    localStorageShim.setItem('ancstra-tree-show-dates', 'yes');
    expect(readShowDates()).toBeNull();
    localStorageShim.setItem('ancstra-tree-show-dates', '');
    expect(readShowDates()).toBeNull();
  });

  // --- coloring radio ------------------------------------------------------
  it('coloring returns null when unset', () => {
    expect(readColoring()).toBeNull();
  });

  it.each(['off', 'generation', 'branch', 'living'] as const)(
    'coloring roundtrips %s',
    (value) => {
      writeColoring(value);
      expect(readColoring()).toBe(value);
    },
  );

  it('coloring returns null for unknown values', () => {
    localStorageShim.setItem('ancstra-tree-coloring', 'rainbow');
    expect(readColoring()).toBeNull();
  });

  // --- edge-style radio ----------------------------------------------------
  it('edge-style returns null when unset', () => {
    expect(readEdgeStyle()).toBeNull();
  });

  it.each(['curved', 'stepped', 'straight'] as const)(
    'edge-style roundtrips %s',
    (value) => {
      writeEdgeStyle(value);
      expect(readEdgeStyle()).toBe(value);
    },
  );

  it('edge-style returns null for unknown values', () => {
    localStorageShim.setItem('ancstra-tree-edges', 'noodle');
    expect(readEdgeStyle()).toBeNull();
  });
});
