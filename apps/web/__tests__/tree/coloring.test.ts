import { describe, it, expect } from 'vitest';
import {
  computeColoringMap,
  computeGenerationDepth,
  computeBranchTones,
} from '../../lib/tree/coloring';
import type {
  TreeData,
  FamilyRecord,
  ChildLink,
  PersonListItem,
} from '@ancstra/shared';

function p(
  id: string,
  sex: 'M' | 'F' | 'U' = 'U',
  isLiving = true,
): PersonListItem {
  return { id, givenName: id, surname: id, sex, isLiving };
}
function fam(id: string, p1: string | null, p2: string | null): FamilyRecord {
  return { id, partner1Id: p1, partner2Id: p2, relationshipType: 'married', validationStatus: 'confirmed' };
}
function child(familyId: string, personId: string): ChildLink {
  return { familyId, personId, validationStatus: 'confirmed' };
}

// gp1(M)+gp2(F) -> dad(M)
// gp3(M)+gp4(F) -> mom(F)
// dad+mom -> me, sibling
// me+spouse -> kid
function makeTree(): TreeData {
  return {
    persons: [
      p('gp1', 'M'), p('gp2', 'F'),
      p('gp3', 'M'), p('gp4', 'F'),
      p('dad', 'M'), p('mom', 'F'),
      p('me', 'M', true),
      p('sibling', 'F', true),
      p('spouse', 'F', true),
      p('kid', 'U', true),
      p('unrelated', 'U', false),
    ],
    families: [
      fam('fam-paternal-gp', 'gp1', 'gp2'),
      fam('fam-maternal-gp', 'gp3', 'gp4'),
      fam('fam-parents', 'dad', 'mom'),
      fam('fam-mine', 'me', 'spouse'),
    ],
    childLinks: [
      child('fam-paternal-gp', 'dad'),
      child('fam-maternal-gp', 'mom'),
      child('fam-parents', 'me'),
      child('fam-parents', 'sibling'),
      child('fam-mine', 'kid'),
    ],
  };
}

describe('computeColoringMap', () => {
  describe("mode 'off'", () => {
    it('returns an empty map', () => {
      const m = computeColoringMap(makeTree(), 'off', 'me');
      expect(m.size).toBe(0);
    });
  });

  describe("mode 'living'", () => {
    it('assigns a tone to every person', () => {
      const m = computeColoringMap(makeTree(), 'living');
      expect(m.size).toBe(makeTree().persons.length);
    });
    it('uses different tones for living vs deceased', () => {
      const m = computeColoringMap(makeTree(), 'living');
      const meTone = m.get('me');
      const unrelatedTone = m.get('unrelated');
      expect(meTone).toBeDefined();
      expect(unrelatedTone).toBeDefined();
      expect(meTone).not.toEqual(unrelatedTone);
    });
    it('every tone exposes both bg (fill) and border variants', () => {
      const m = computeColoringMap(makeTree(), 'living');
      for (const tone of m.values()) {
        expect(tone.bg).toMatch(/^var\(--tree-coloring-/);
        expect(tone.border).toMatch(/^var\(--tree-coloring-.+-border\)$/);
      }
    });
    it('bg and border for the same mode are distinct tokens', () => {
      const m = computeColoringMap(makeTree(), 'living');
      for (const tone of m.values()) {
        expect(tone.bg).not.toBe(tone.border);
      }
    });
  });

  describe("mode 'generation'", () => {
    it('focus is depth 0, parents -1, children +1, grandparents -2', () => {
      const depths = computeGenerationDepth(makeTree(), 'me');
      expect(depths.get('me')).toBe(0);
      expect(depths.get('dad')).toBe(-1);
      expect(depths.get('mom')).toBe(-1);
      expect(depths.get('gp1')).toBe(-2);
      expect(depths.get('gp4')).toBe(-2);
      expect(depths.get('kid')).toBe(1);
      // sibling shares parents — same generation as focus.
      expect(depths.get('sibling')).toBe(0);
    });
    it('without focus uses roots; roots start at depth 0', () => {
      const depths = computeGenerationDepth(makeTree());
      expect(depths.get('gp1')).toBe(0);
      expect(depths.get('gp4')).toBe(0);
      expect(depths.get('dad')).toBe(1);
      expect(depths.get('me')).toBe(2);
      expect(depths.get('kid')).toBe(3);
    });
    it('returns a tone for every reachable person', () => {
      const m = computeColoringMap(makeTree(), 'generation', 'me');
      // Everyone in this fixture is reachable from me.
      for (const id of ['me', 'dad', 'mom', 'gp1', 'gp4', 'kid', 'sibling']) {
        expect(m.has(id)).toBe(true);
      }
    });
  });

  describe("mode 'branch'", () => {
    it("returns an empty map without focus (visual no-op)", () => {
      const m = computeColoringMap(makeTree(), 'branch');
      expect(m.size).toBe(0);
    });

    it('paints paternal vs maternal sides distinctly, focus + descendants self', () => {
      const m = computeBranchTones(makeTree(), 'me');
      const dadTone = m.get('dad');
      const momTone = m.get('mom');
      const meTone = m.get('me');
      const kidTone = m.get('kid');
      expect(dadTone).toBeDefined();
      expect(momTone).toBeDefined();
      expect(dadTone).not.toEqual(momTone);
      // Focus self
      expect(meTone).toBeDefined();
      expect(meTone).not.toEqual(dadTone);
      expect(meTone).not.toEqual(momTone);
      // Descendant inherits self.
      expect(kidTone).toEqual(meTone);
      // Paternal grandparent is paternal.
      expect(m.get('gp1')).toEqual(dadTone);
      // Maternal grandparent is maternal.
      expect(m.get('gp4')).toEqual(momTone);
    });

    it('does not paint unrelated people', () => {
      const m = computeBranchTones(makeTree(), 'me');
      expect(m.has('unrelated')).toBe(false);
    });

    it('siblings inherit from the parent line (paternal here, since the focus path tags them as a paternal-grandparent descendant)', () => {
      // 'sibling' is a descendant of paternal grandparents AND maternal grandparents.
      // In this implementation paternal is painted first (after self), so sibling
      // gets paternal.
      const m = computeBranchTones(makeTree(), 'me');
      expect(m.get('sibling')).toEqual(m.get('dad'));
    });
  });
});
