import { describe, it, expect } from 'vitest';
import { hashPatchDiff, type PatchDiff } from '../../factsheets/patch';

/**
 * Bundle C 2026-05-24 — hashPatchDiff stability.
 * Spec §2.3: same logical diff → same hash, regardless of input array order
 * for `unchanged` lists and `deltas` within a modified event. Any meaningful
 * value change must produce a different hash.
 */
const baseDiff: PatchDiff = {
  factsheetId: 'F1',
  personId: 'P1',
  events: {
    added: [
      {
        eventType: 'birth',
        dateOriginal: '1887',
        dateSort: 1887,
        placeText: 'X',
        description: null,
      },
    ],
    modified: [
      {
        eventId: 'E1',
        eventType: 'death',
        deltas: [
          { field: 'placeText', before: 'Y', after: 'Z' },
          { field: 'dateOriginal', before: '1950', after: '1951' },
        ],
      },
    ],
    unchanged: ['E2', 'E3'],
  },
  citations: {
    added: [],
    unchanged: ['C1', 'C2'],
  },
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe('hashPatchDiff', () => {
  it('returns a 64-char hex string', () => {
    const h = hashPatchDiff(baseDiff);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is stable across unchanged-array reorderings', () => {
    const a = hashPatchDiff(baseDiff);
    const swapped = clone(baseDiff);
    swapped.events.unchanged = ['E3', 'E2'];
    swapped.citations.unchanged = ['C2', 'C1'];
    const b = hashPatchDiff(swapped);
    expect(b).toBe(a);
  });

  it('is stable across delta-array reorderings within a modified event', () => {
    const a = hashPatchDiff(baseDiff);
    const swapped = clone(baseDiff);
    swapped.events.modified[0].deltas = [
      { field: 'dateOriginal', before: '1950', after: '1951' },
      { field: 'placeText', before: 'Y', after: 'Z' },
    ];
    const b = hashPatchDiff(swapped);
    expect(b).toBe(a);
  });

  it('changes when an added field value changes', () => {
    const a = hashPatchDiff(baseDiff);
    const mutated = clone(baseDiff);
    mutated.events.added[0].placeText = 'X-different';
    const b = hashPatchDiff(mutated);
    expect(b).not.toBe(a);
  });

  it('changes when factsheetId changes', () => {
    const a = hashPatchDiff(baseDiff);
    const mutated = clone(baseDiff);
    mutated.factsheetId = 'F2';
    const b = hashPatchDiff(mutated);
    expect(b).not.toBe(a);
  });
});
