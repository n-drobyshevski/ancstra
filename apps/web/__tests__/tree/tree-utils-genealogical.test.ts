import { describe, it, expect } from 'vitest';
import { applyDagreLayout, treeDataToFlow } from '../../components/tree/tree-utils';
import type {
  PersonListItem,
  FamilyRecord,
  ChildLink,
  TreeData,
} from '@ancstra/shared';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function person(
  id: string,
  sex: 'M' | 'F' | 'U' = 'U',
  birthDate: string | null = null,
): PersonListItem {
  return { id, givenName: id, surname: id, sex, isLiving: true, birthDate };
}

function family(
  id: string,
  p1: string | null,
  p2: string | null,
): FamilyRecord {
  return {
    id,
    partner1Id: p1,
    partner2Id: p2,
    relationshipType: 'married',
    validationStatus: 'confirmed',
  };
}

function link(
  familyId: string,
  personId: string,
  childOrder?: number,
): ChildLink {
  const cl: ChildLink = { familyId, personId, validationStatus: 'confirmed' };
  if (childOrder !== undefined) cl.childOrder = childOrder;
  return cl;
}

function lay(
  data: TreeData,
  opts?: { genealogicalOrdering?: boolean },
) {
  const { nodes, edges } = treeDataToFlow(data, opts);
  return applyDagreLayout(nodes, edges, undefined, 'wide', opts);
}

function xOf(nodes: ReturnType<typeof lay>, id: string): number {
  const n = nodes.find((x) => x.id === id);
  if (!n) throw new Error(`node ${id} not found`);
  return n.position.x;
}

// ---------------------------------------------------------------------------
// 1. Sibling order — eldest leftmost
// ---------------------------------------------------------------------------

describe('genealogical ordering — siblings', () => {
  it('orders siblings left-to-right by birth date (eldest leftmost)', () => {
    const data: TreeData = {
      persons: [
        person('mom', 'F', '1860-01-01'),
        person('dad', 'M', '1858-01-01'),
        person('c1900', 'U', '1900-01-01'),
        person('c1880', 'U', '1880-01-01'),
        person('c1890', 'U', '1890-01-01'),
      ],
      families: [family('f1', 'mom', 'dad')],
      childLinks: [
        link('f1', 'c1900'),
        link('f1', 'c1880'),
        link('f1', 'c1890'),
      ],
    };

    const out = lay(data);
    expect(xOf(out, 'c1880')).toBeLessThan(xOf(out, 'c1890'));
    expect(xOf(out, 'c1890')).toBeLessThan(xOf(out, 'c1900'));
  });

  it('places undated siblings to the right of dated ones; childOrder breaks ties', () => {
    const data: TreeData = {
      persons: [
        person('mom', 'F', '1850-01-01'),
        person('dad', 'M', '1848-01-01'),
        person('cA', 'U', '1880-01-01'),
        person('cB', 'U', '1885-01-01'),
        person('cC', 'U', null),
        person('cD', 'U', null),
      ],
      families: [family('f1', 'mom', 'dad')],
      childLinks: [
        link('f1', 'cA'),
        link('f1', 'cB'),
        // Out-of-order in the array; childOrder ties go cD (1) then cC (2).
        link('f1', 'cC', 2),
        link('f1', 'cD', 1),
      ],
    };

    const out = lay(data);
    // dated first, ascending
    expect(xOf(out, 'cA')).toBeLessThan(xOf(out, 'cB'));
    // both undated come AFTER both dated
    expect(xOf(out, 'cB')).toBeLessThan(xOf(out, 'cD'));
    expect(xOf(out, 'cB')).toBeLessThan(xOf(out, 'cC'));
    // childOrder breaks the undated tie (cD=1 < cC=2)
    expect(xOf(out, 'cD')).toBeLessThan(xOf(out, 'cC'));
  });
});

// ---------------------------------------------------------------------------
// 2. Mother-left at the parent rank
// ---------------------------------------------------------------------------

describe('genealogical ordering — mother-left invariant', () => {
  it('places mother (sex F) left of father (sex M) in the parent pair', () => {
    const data: TreeData = {
      persons: [
        person('m', 'F', '1860-01-01'),
        person('d', 'M', '1858-01-01'),
        person('c', 'U', '1885-01-01'),
      ],
      families: [family('f1', 'd', 'm')], // partner1=dad on purpose
      childLinks: [link('f1', 'c')],
    };

    const out = lay(data);
    expect(xOf(out, 'm')).toBeLessThan(xOf(out, 'd'));
  });
});

// ---------------------------------------------------------------------------
// 3. Father's branch trends right (3 generations)
// ---------------------------------------------------------------------------

describe('genealogical ordering — paternal lineage trends right', () => {
  it('places paternal grandparents to the right of maternal grandparents', () => {
    // 3 generations: 4 grandparents, 2 parents, 1 child.
    const data: TreeData = {
      persons: [
        person('mm', 'F', '1830-01-01'),
        person('mf', 'M', '1828-01-01'),
        person('fm', 'F', '1832-01-01'),
        person('ff', 'M', '1830-06-01'),
        person('mom', 'F', '1860-01-01'),
        person('dad', 'M', '1858-01-01'),
        person('child', 'U', '1885-01-01'),
      ],
      families: [
        family('f-maternal', 'mm', 'mf'),
        family('f-paternal', 'fm', 'ff'),
        family('f-couple', 'mom', 'dad'),
      ],
      childLinks: [
        link('f-maternal', 'mom'),
        link('f-paternal', 'dad'),
        link('f-couple', 'child'),
      ],
    };

    const out = lay(data);
    const mmX = xOf(out, 'mm');
    const mfX = xOf(out, 'mf');
    const fmX = xOf(out, 'fm');
    const ffX = xOf(out, 'ff');

    // Both paternal grandparents are to the right of both maternal grandparents.
    expect(fmX).toBeGreaterThan(mmX);
    expect(fmX).toBeGreaterThan(mfX);
    expect(ffX).toBeGreaterThan(mmX);
    expect(ffX).toBeGreaterThan(mfX);

    // And mother is left of father at mid rank.
    expect(xOf(out, 'mom')).toBeLessThan(xOf(out, 'dad'));
  });
});

// ---------------------------------------------------------------------------
// 4. Toggle off restores legacy behaviour
// ---------------------------------------------------------------------------

describe('genealogical ordering — toggle off', () => {
  it('with genealogicalOrdering=false, sibling layout ignores birth dates', () => {
    // Same persons + insertion order in both data sets — only birth dates
    // differ. With ordering OFF, X positions must be identical (Dagre's
    // layout depends only on graph structure + insertion order, NOT dates).
    const personsA: PersonListItem[] = [
      person('mom', 'F', '1860-01-01'),
      person('dad', 'M', '1858-01-01'),
      person('cA', 'U', '1900-01-01'),
      person('cB', 'U', '1890-01-01'),
      person('cC', 'U', '1880-01-01'),
    ];
    const personsB: PersonListItem[] = [
      person('mom', 'F', '1860-01-01'),
      person('dad', 'M', '1858-01-01'),
      person('cA', 'U', '1880-01-01'),
      person('cB', 'U', '1890-01-01'),
      person('cC', 'U', '1900-01-01'),
    ];
    const families = [family('f1', 'mom', 'dad')];
    const childLinks = [link('f1', 'cA'), link('f1', 'cB'), link('f1', 'cC')];

    const offA = lay({ persons: personsA, families, childLinks }, { genealogicalOrdering: false });
    const offB = lay({ persons: personsB, families, childLinks }, { genealogicalOrdering: false });
    expect(xOf(offA, 'cA')).toBe(xOf(offB, 'cA'));
    expect(xOf(offA, 'cB')).toBe(xOf(offB, 'cB'));
    expect(xOf(offA, 'cC')).toBe(xOf(offB, 'cC'));

    // Sanity: with ordering ON, the two layouts MUST differ (cA-eldest vs
    // cC-eldest changes who lands leftmost).
    const onA = lay({ persons: personsA, families, childLinks }, { genealogicalOrdering: true });
    const onB = lay({ persons: personsB, families, childLinks }, { genealogicalOrdering: true });
    // In B, cA is the eldest → leftmost.
    expect(xOf(onB, 'cA')).toBeLessThan(xOf(onB, 'cB'));
    expect(xOf(onB, 'cB')).toBeLessThan(xOf(onB, 'cC'));
    // In A, cC is the eldest → leftmost.
    expect(xOf(onA, 'cC')).toBeLessThan(xOf(onA, 'cB'));
    expect(xOf(onA, 'cB')).toBeLessThan(xOf(onA, 'cA'));
  });
});

// ---------------------------------------------------------------------------
// 5. Single-parent + U-sex — does not throw and orders by date
// ---------------------------------------------------------------------------

describe('genealogical ordering — robustness', () => {
  it('handles single-parent families with sex=U without throwing', () => {
    const data: TreeData = {
      persons: [
        person('p', 'U', '1860-01-01'),
        person('cA', 'U', '1885-01-01'),
        person('cB', 'U', '1880-01-01'),
      ],
      families: [family('f1', 'p', null)],
      childLinks: [link('f1', 'cA'), link('f1', 'cB')],
    };

    expect(() => lay(data)).not.toThrow();
    const out = lay(data);
    // Even with sex=U, sibling ordering still applies.
    expect(xOf(out, 'cB')).toBeLessThan(xOf(out, 'cA'));
  });

  it('does not throw on an empty tree', () => {
    expect(() => lay({ persons: [], families: [], childLinks: [] })).not.toThrow();
  });

  it('singleton parent (no spouse in view) follows their child after a swap', () => {
    // Reproduces the screenshot bug: paternal grandfather (Aleksey) shown as
    // sole parent of dad (Vladimir). Without an anchor pass for singleton
    // parents, the grandfather keeps Dagre's stale X and ends up far from
    // his child. He should sit roughly above his child.
    const data: TreeData = {
      persons: [
        person('granddad', 'M', '1948-02-29'),
        person('mom', 'F', '1978-07-31'),
        person('dad', 'M', '1978-02-28'),
        person('k1', 'F', '2002-05-28'),
        person('k2', 'M', '2004-03-15'),
        person('k3', 'F', '2006-03-09'),
      ],
      families: [
        family('f-paternal', 'granddad', null), // single parent of dad
        family('f-couple', 'mom', 'dad'),
      ],
      childLinks: [
        link('f-paternal', 'dad'),
        link('f-couple', 'k1'),
        link('f-couple', 'k2'),
        link('f-couple', 'k3'),
      ],
    };

    const out = lay(data);
    const granddadX = xOf(out, 'granddad');
    const dadX = xOf(out, 'dad');
    const momX = xOf(out, 'mom');

    // Grandfather should sit roughly above his only child (within one card-width).
    expect(Math.abs(granddadX - dadX)).toBeLessThanOrEqual(240);
    // And the granddad must NOT be left of mom — dad is to mom's right and
    // grandfather follows dad.
    expect(granddadX).toBeGreaterThan(momX);

    // Mom and dad form a tight couple — a SOLO ancestor above one parent
    // doesn't need pair-spread room. Center-to-center ≈ width + partnerGap
    // (240 + 40 = 280); allow a small tolerance.
    expect(Math.abs(dadX - momX)).toBeLessThanOrEqual(300);
  });
});
