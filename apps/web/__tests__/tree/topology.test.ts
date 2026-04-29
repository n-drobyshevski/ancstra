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

  it('walks down through grandchildren (strict blood line by default)', () => {
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

describe('computeDescendants (includeCoParents)', () => {
  it('adds the co-parent (spouse) of every family that produces a descendant', () => {
    // p1's biological descendants are c1, c2, grandchild. With
    // includeCoParents, we also surface p2 (p1's spouse — co-parent of
    // c1 and c2) and 'spouse' (c1's spouse — co-parent of grandchild)
    // so the rendered tree shows each child with both parents.
    expect(
      computeDescendants('p1', makeTree(), { includeCoParents: true }),
    ).toEqual(new Set(['p2', 'c1', 'c2', 'spouse', 'grandchild']));
  });

  it('adds spouses across multiple families (remarriage)', () => {
    const tree: TreeData = {
      persons: [p('parent'), p('a'), p('b'), p('c1'), p('c2')],
      families: [fam('f1', 'parent', 'a'), fam('f2', 'parent', 'b')],
      childLinks: [child('f1', 'c1'), child('f2', 'c2')],
    };
    expect(
      computeDescendants('parent', tree, { includeCoParents: true }),
    ).toEqual(new Set(['a', 'b', 'c1', 'c2']));
  });

  it('does NOT add the spouse of a childless marriage', () => {
    // X is married to Y but they have no children. Y is not a co-parent
    // of any descendant of X, so Y is not added. Otherwise "Show
    // descendants of X" would surface Y as a "descendant" — wrong.
    const tree: TreeData = {
      persons: [p('X'), p('Y')],
      families: [fam('f1', 'X', 'Y')],
      childLinks: [],
    };
    expect(computeDescendants('X', tree, { includeCoParents: true })).toEqual(
      new Set(),
    );
  });

  it('does NOT traverse through co-parents (no step-grandchildren)', () => {
    // X has child C with spouse S. S also has another marriage with
    // SOther, producing 'step' (S's child but NOT X's descendant).
    // S is added (X's co-parent of C) but NOT enqueued, so 'step' and
    // 'SOther' must NOT be added.
    const tree: TreeData = {
      persons: [p('X'), p('S'), p('SOther'), p('C'), p('step')],
      families: [
        fam('fXS', 'X', 'S'),
        fam('fSOther', 'S', 'SOther'),
      ],
      childLinks: [
        child('fXS', 'C'),
        child('fSOther', 'step'),
      ],
    };
    expect(computeDescendants('X', tree, { includeCoParents: true })).toEqual(
      new Set(['S', 'C']),
    );
  });

  it('default (no opts) behaves as strict blood line — does not include co-parents', () => {
    // Regression guard: branch-coloring callers and other consumers
    // expect the default to be unchanged.
    const tree: TreeData = {
      persons: [p('X'), p('Y'), p('child')],
      families: [fam('f1', 'X', 'Y')],
      childLinks: [child('f1', 'child')],
    };
    expect(computeDescendants('X', tree)).toEqual(new Set(['child']));
  });
});
