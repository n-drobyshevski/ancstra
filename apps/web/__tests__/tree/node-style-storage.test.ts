import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  readNodeStylePreference,
  writeNodeStylePreference,
} from '../../lib/tree/node-style-storage';

const STORAGE_KEY = 'ancstra-tree-node-style';

// Vitest env defaults to `node` for this project, so window/localStorage don't
// exist. Install a tiny in-memory shim before each test.
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

describe('node-style-storage', () => {
  beforeEach(() => {
    localStorageShim.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(readNodeStylePreference()).toBeNull();
  });

  it('roundtrips wide', () => {
    writeNodeStylePreference('wide');
    expect(readNodeStylePreference()).toBe('wide');
  });

  it('roundtrips compact', () => {
    writeNodeStylePreference('compact');
    expect(readNodeStylePreference()).toBe('compact');
  });

  it('overwrites a prior value', () => {
    writeNodeStylePreference('compact');
    writeNodeStylePreference('wide');
    expect(readNodeStylePreference()).toBe('wide');
  });

  it('returns null for unknown values written directly to storage', () => {
    localStorageShim.setItem(STORAGE_KEY, 'gigantic');
    expect(readNodeStylePreference()).toBeNull();
  });

  it('returns null for an empty string', () => {
    localStorageShim.setItem(STORAGE_KEY, '');
    expect(readNodeStylePreference()).toBeNull();
  });
});
