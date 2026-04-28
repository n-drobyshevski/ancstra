import { describe, it, expect } from 'vitest';
import { buildSeeOnTreeSearch } from '../../lib/tree/see-on-tree';

const PERSON_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

function parse(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe('buildSeeOnTreeSearch', () => {
  it('sets view=canvas and focus=<id> on an empty start', () => {
    const out = parse(buildSeeOnTreeSearch(new URLSearchParams(), PERSON_ID));
    expect(out.get('view')).toBe('canvas');
    expect(out.get('focus')).toBe(PERSON_ID);
  });

  it('forces view=canvas even when starting on table', () => {
    const start = new URLSearchParams({ view: 'table' });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('view')).toBe('canvas');
  });

  it('overwrites a pre-existing focus param', () => {
    const start = new URLSearchParams({ focus: 'OTHER' });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('focus')).toBe(PERSON_ID);
  });

  it('preserves arbitrary unrelated params (q, sex, bornFrom, complGte)', () => {
    const start = new URLSearchParams({
      q: 'smith',
      sex: 'F',
      bornFrom: '1900',
      complGte: '50',
    });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('q')).toBe('smith');
    expect(out.get('sex')).toBe('F');
    expect(out.get('bornFrom')).toBe('1900');
    expect(out.get('complGte')).toBe('50');
  });

  it('preserves repeated array-style params (e.g. sex=M&sex=F)', () => {
    const start = new URLSearchParams();
    start.append('sex', 'M');
    start.append('sex', 'F');
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.getAll('sex')).toEqual(['M', 'F']);
  });

  it('clears topologyAnchor', () => {
    const start = new URLSearchParams({ topologyAnchor: 'anchor-id' });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('topologyAnchor')).toBeNull();
  });

  it('resets topologyMode to "all" when it was "ancestors"', () => {
    const start = new URLSearchParams({ topologyMode: 'ancestors' });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('topologyMode')).toBe('all');
  });

  it('resets topologyMode to "all" when it was "descendants"', () => {
    const start = new URLSearchParams({ topologyMode: 'descendants' });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('topologyMode')).toBe('all');
  });

  it('leaves topologyMode absent when it was absent', () => {
    const start = new URLSearchParams({ q: 'smith' });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('topologyMode')).toBeNull();
  });

  it('drops the page param', () => {
    const start = new URLSearchParams({ page: '5', q: 'smith' });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('page')).toBeNull();
    expect(out.get('q')).toBe('smith');
  });

  it('clears anchor and resets mode in one go (the topology-was-active path)', () => {
    const start = new URLSearchParams({
      topologyAnchor: 'anchor-id',
      topologyMode: 'ancestors',
      q: 'smith',
    });
    const out = parse(buildSeeOnTreeSearch(start, PERSON_ID));
    expect(out.get('topologyAnchor')).toBeNull();
    expect(out.get('topologyMode')).toBe('all');
    expect(out.get('q')).toBe('smith');
    expect(out.get('view')).toBe('canvas');
    expect(out.get('focus')).toBe(PERSON_ID);
  });

  it('does not mutate the caller-supplied URLSearchParams', () => {
    const start = new URLSearchParams({ view: 'table', topologyAnchor: 'X' });
    buildSeeOnTreeSearch(start, PERSON_ID);
    expect(start.get('view')).toBe('table');
    expect(start.get('topologyAnchor')).toBe('X');
  });
});
