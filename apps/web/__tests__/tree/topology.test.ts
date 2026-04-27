import { describe, it, expect } from 'vitest';
import { computeAncestors, computeDescendants } from '../../lib/tree/topology';
import type { TreeData, FamilyRecord, ChildLink, PersonListItem } from '@ancstra/shared';

function p(id: string): PersonListItem {
  return { id, givenName: id, surname: id, sex: 'U', isLiving: true };
}
function fam(id: string, p1: string | null, p2: string | null): FamilyRecord {
  return { id, partner1Id: p1, partner2Id: p2, relationshipType: 'married', validationStatus: 'confirmed' };
}
function child(familyId: string, personId: string): ChildLink {
  return { familyId, personId, validationStatus: 'confirmed' };
}

function makeTree(): TreeData {
  return {
    persons: [
      p('gp1'), p('gp2'), p('gp3'), p('gp4'),
      p('p1'), p('p2'),
      p('c1'), p('c2'),
      p('spouse'), p('grandchild'),
      p('unrelated'),
    ],
    families: [
      fam('fam-a', 'gp1', 'gp2'),
      fam('fam-b', 'gp3', 'gp4'),
      fam('fam-c', 'p1', 'p2'),
      fam('fam-d', 'c1', 'spouse'),
    ],
    childLinks: [
      child('fam-a', 'p1'),
      child('fam-b', 'p2'),
      child('fam-c', 'c1'),
      child('fam-c', 'c2'),
      child('fam-d', 'grandchild'),
    ],
  };
}

describe('computeAncestors', () => {
  it('returns empty set for a person with no parents', () => {
    expect(computeAncestors('gp1', makeTree())).toEqual(new Set());
  });

  it('returns immediate parents only when grandparents are absent', () => {
    const tree: TreeData = {
      persons: [p('child'), p('mom'), p('dad')],
      families: [fam('f1', 'mom', 'dad')],
      childLinks: [child('f1', 'child')],
    };
    expect(computeAncestors('child', tree)).toEqual(new Set(['mom', 'dad']));
  });

  it('walks up through grandparents', () => {
    expect(computeAncestors('c1', makeTree())).toEqual(new Set(['p1', 'p2', 'gp1', 'gp2', 'gp3', 'gp4']));
  });

  it('does NOT include the reference person itself', () => {
    expect(computeAncestors('c1', makeTree()).has('c1')).toBe(false);
  });

  it('returns empty for a non-existent person id', () => {
    expect(computeAncestors('nonexistent', makeTree())).toEqual(new Set());
  });

  it('handles single-parent families (one partner null)', () => {
    const tree: TreeData = {
      persons: [p('child'), p('mom')],
      families: [fam('f1', 'mom', null)],
      childLinks: [child('f1', 'child')],
    };
    expect(computeAncestors('child', tree)).toEqual(new Set(['mom']));
  });

  it('survives cycles without infinite loop', () => {
    const tree: TreeData = {
      persons: [p('A'), p('B')],
      families: [fam('f1', 'A', null), fam('f2', 'B', null)],
      childLinks: [child('f1', 'B'), child('f2', 'A')],
    };
    const result = computeAncestors('A', tree);
    expect(result.has('B')).toBe(true);
    expect(result.has('A')).toBe(false);
  });
});

describe('computeDescendants', () => {
  it('returns empty set for a person with no children', () => {
    expect(computeDescendants('grandchild', makeTree())).toEqual(new Set());
  });

  it('walks down through grandchildren', () => {
    expect(computeDescendants('p1', makeTree())).toEqual(new Set(['c1', 'c2', 'grandchild']));
  });

  it('does NOT include the reference person itself', () => {
    expect(computeDescendants('p1', makeTree()).has('p1')).toBe(false);
  });

  it('includes children from multiple families (e.g., remarriage)', () => {
    const tree: TreeData = {
      persons: [p('parent'), p('a'), p('b'), p('c1'), p('c2')],
      families: [fam('f1', 'parent', 'a'), fam('f2', 'parent', 'b')],
      childLinks: [child('f1', 'c1'), child('f2', 'c2')],
    };
    expect(computeDescendants('parent', tree)).toEqual(new Set(['c1', 'c2']));
  });

  it('returns empty for a non-existent person id', () => {
    expect(computeDescendants('nonexistent', makeTree())).toEqual(new Set());
  });

  it('survives cycles without infinite loop', () => {
    const tree: TreeData = {
      persons: [p('A'), p('B')],
      families: [fam('f1', 'A', null), fam('f2', 'B', null)],
      childLinks: [child('f1', 'B'), child('f2', 'A')],
    };
    const result = computeDescendants('A', tree);
    expect(result.has('B')).toBe(true);
    expect(result.has('A')).toBe(false);
  });
});
