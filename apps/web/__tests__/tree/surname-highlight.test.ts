import { describe, it, expect } from 'vitest';
import {
  computePatrilinealComponents,
  computeSurnameHighlightSet,
  collectSurnameOptions,
  normalizeSurname,
} from '../../lib/tree/surname-highlight';
import type {
  TreeData,
  FamilyRecord,
  ChildLink,
  PersonListItem,
} from '@ancstra/shared';

function person(
  id: string,
  surname: string,
  sex: 'M' | 'F' | 'U' = 'U',
): PersonListItem {
  return { id, givenName: id, surname, sex, isLiving: true };
}
function family(id: string, p1: string | null, p2: string | null): FamilyRecord {
  return {
    id,
    partner1Id: p1,
    partner2Id: p2,
    relationshipType: 'married',
    validationStatus: 'confirmed',
  };
}
function child(familyId: string, personId: string): ChildLink {
  return { familyId, personId, validationStatus: 'confirmed' };
}

describe('normalizeSurname', () => {
  it('lowercases and trims', () => {
    expect(normalizeSurname('  Smith  ')).toBe('smith');
    expect(normalizeSurname('SMITH')).toBe('smith');
    expect(normalizeSurname(null)).toBe('');
    expect(normalizeSurname(undefined)).toBe('');
    expect(normalizeSurname('')).toBe('');
  });
});

describe('computePatrilinealComponents', () => {
  it('treats every person as their own component when there are no families', () => {
    const tree: TreeData = {
      persons: [person('a', 'Smith', 'M'), person('b', 'Jones', 'F')],
      families: [],
      childLinks: [],
    };
    const { componentOf, members } = computePatrilinealComponents(tree);
    expect(componentOf.get('a')).toBeDefined();
    expect(componentOf.get('b')).toBeDefined();
    expect(componentOf.get('a')).not.toBe(componentOf.get('b'));
    expect(members.size).toBe(2);
  });

  it('connects father → child but NOT mother → child', () => {
    // Smith (M) + Jones (F) → kid
    const tree: TreeData = {
      persons: [
        person('dad', 'Smith', 'M'),
        person('mom', 'Jones', 'F'),
        person('kid', 'Smith', 'M'),
      ],
      families: [family('f', 'dad', 'mom')],
      childLinks: [child('f', 'kid')],
    };
    const { componentOf } = computePatrilinealComponents(tree);
    // dad and kid share a component (father edge); mom is in her own.
    expect(componentOf.get('dad')).toBe(componentOf.get('kid'));
    expect(componentOf.get('mom')).not.toBe(componentOf.get('dad'));
  });

  it('does not add a patrilineal edge when neither parent is male', () => {
    const tree: TreeData = {
      persons: [
        person('p1', 'Smith', 'F'),
        person('p2', 'Jones', 'F'),
        person('kid', 'Smith', 'U'),
      ],
      families: [family('f', 'p1', 'p2')],
      childLinks: [child('f', 'kid')],
    };
    const { componentOf } = computePatrilinealComponents(tree);
    expect(componentOf.get('kid')).not.toBe(componentOf.get('p1'));
    expect(componentOf.get('kid')).not.toBe(componentOf.get('p2'));
  });
});

describe('computeSurnameHighlightSet', () => {
  // Three-generation Smith line; daughter marries out and has children with a
  // Jones husband. We expect:
  //  - The Smith patriarch + sons + grandsons are in the Smith component.
  //  - The daughter Mary Smith is in the Smith component (father edge).
  //  - Mary's children are in the Jones component (their father is Jones).
  //  - Jones is unrelated to the Smith branch.
  function makeMixedTree(): TreeData {
    return {
      persons: [
        // Smith line
        person('smith-sr', 'Smith', 'M'),
        person('smith-jr', 'Smith', 'M'),
        person('mary-smith', 'Smith', 'F'),
        person('smith-grandson', 'Smith', 'M'),
        // Smith Sr's wife (married in)
        person('smith-sr-wife', 'Doe', 'F'),
        // Mary's husband (married in to Smith family) and their kids
        person('jones', 'Jones', 'M'),
        person('mary-kid-1', 'Jones', 'M'),
        person('mary-kid-2', 'Jones', 'F'),
        // Smith Jr's wife and their kid
        person('smith-jr-wife', 'Doe', 'F'),
        // an unrelated person
        person('unrelated', 'Brown', 'M'),
      ],
      families: [
        family('f-sr', 'smith-sr', 'smith-sr-wife'),
        family('f-jr', 'smith-jr', 'smith-jr-wife'),
        family('f-mary', 'jones', 'mary-smith'),
      ],
      childLinks: [
        // Smith Sr's children
        child('f-sr', 'smith-jr'),
        child('f-sr', 'mary-smith'),
        // Smith Jr's child
        child('f-jr', 'smith-grandson'),
        // Mary + Jones's children
        child('f-mary', 'mary-kid-1'),
        child('f-mary', 'mary-kid-2'),
      ],
    };
  }

  it('returns an empty set for empty / missing surname', () => {
    const tree = makeMixedTree();
    expect(computeSurnameHighlightSet(tree, '').size).toBe(0);
    expect(computeSurnameHighlightSet(tree, null).size).toBe(0);
    expect(computeSurnameHighlightSet(tree, undefined).size).toBe(0);
  });

  it('includes the Smith patriarch + male-line descendants', () => {
    const tree = makeMixedTree();
    const set = computeSurnameHighlightSet(tree, 'Smith');
    expect(set.has('smith-sr')).toBe(true);
    expect(set.has('smith-jr')).toBe(true);
    expect(set.has('smith-grandson')).toBe(true);
  });

  it('includes daughters born into the line (e.g. Mary Smith)', () => {
    const tree = makeMixedTree();
    const set = computeSurnameHighlightSet(tree, 'Smith');
    expect(set.has('mary-smith')).toBe(true);
  });

  it("excludes a married-out daughter's children (different patrilineal line)", () => {
    const tree = makeMixedTree();
    const set = computeSurnameHighlightSet(tree, 'Smith');
    expect(set.has('mary-kid-1')).toBe(false);
    expect(set.has('mary-kid-2')).toBe(false);
  });

  it('excludes married-in spouses (no incoming father edge from the line)', () => {
    const tree = makeMixedTree();
    const set = computeSurnameHighlightSet(tree, 'Smith');
    expect(set.has('smith-sr-wife')).toBe(false);
    expect(set.has('smith-jr-wife')).toBe(false);
    expect(set.has('jones')).toBe(false);
  });

  it('excludes unrelated persons in unrelated branches', () => {
    const tree = makeMixedTree();
    const set = computeSurnameHighlightSet(tree, 'Smith');
    expect(set.has('unrelated')).toBe(false);
  });

  it('matches surnames case-insensitively', () => {
    const tree = makeMixedTree();
    const lower = computeSurnameHighlightSet(tree, 'smith');
    const upper = computeSurnameHighlightSet(tree, 'SMITH');
    const mixed = computeSurnameHighlightSet(tree, '  SmItH ');
    expect(lower).toEqual(upper);
    expect(lower).toEqual(mixed);
  });

  it('handles two unrelated patrilineal Smith branches independently', () => {
    // Two unrelated Smith men, neither connected to the other.
    const tree: TreeData = {
      persons: [
        person('a-smith', 'Smith', 'M'),
        person('a-son', 'Smith', 'M'),
        person('b-smith', 'Smith', 'M'),
        person('b-son', 'Smith', 'M'),
      ],
      families: [
        family('fa', 'a-smith', null),
        family('fb', 'b-smith', null),
      ],
      childLinks: [child('fa', 'a-son'), child('fb', 'b-son')],
    };
    const set = computeSurnameHighlightSet(tree, 'Smith');
    expect(set.size).toBe(4);
    expect(set.has('a-smith')).toBe(true);
    expect(set.has('a-son')).toBe(true);
    expect(set.has('b-smith')).toBe(true);
    expect(set.has('b-son')).toBe(true);
  });
});

describe('collectSurnameOptions', () => {
  it('returns surnames sorted by frequency desc, alphabetical tie-break', () => {
    const tree: TreeData = {
      persons: [
        person('a', 'Smith'),
        person('b', 'Smith'),
        person('c', 'Smith'),
        person('d', 'Jones'),
        person('e', 'Jones'),
        person('f', 'Brown'),
      ],
      families: [],
      childLinks: [],
    };
    const opts = collectSurnameOptions(tree);
    expect(opts.map((o) => o.value)).toEqual(['smith', 'jones', 'brown']);
    expect(opts[0].count).toBe(3);
    expect(opts[1].count).toBe(2);
    expect(opts[2].count).toBe(1);
  });

  it('groups case variants together but picks the most-frequent label casing', () => {
    const tree: TreeData = {
      persons: [
        person('a', 'smith'),
        person('b', 'Smith'),
        person('c', 'Smith'),
      ],
      families: [],
      childLinks: [],
    };
    const opts = collectSurnameOptions(tree);
    expect(opts.length).toBe(1);
    expect(opts[0].value).toBe('smith');
    expect(opts[0].label).toBe('Smith'); // most-frequent casing wins
    expect(opts[0].count).toBe(3);
  });

  it('skips empty / whitespace-only surnames', () => {
    const tree: TreeData = {
      persons: [
        person('a', 'Smith'),
        person('b', ''),
        person('c', '   '),
      ],
      families: [],
      childLinks: [],
    };
    const opts = collectSurnameOptions(tree);
    expect(opts.length).toBe(1);
    expect(opts[0].value).toBe('smith');
  });
});
