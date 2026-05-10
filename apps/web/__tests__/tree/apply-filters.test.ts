import { describe, it, expect } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  applyFilters,
  matchesCanvasFilters,
  type CanvasFilterInput,
  type PersonNodeData,
} from '../../components/tree/tree-utils';

/** Build a CanvasFilterInput pre-set to "no filters active". Tests then patch
 *  individual dimensions to exercise predicates in isolation. */
const NO_FILTERS: CanvasFilterInput = {
  q: '',
  sex: [],
  living: [],
  validation: [],
  bornFrom: null,
  bornTo: null,
  diedFrom: null,
  diedTo: null,
  place: '',
  placeScope: 'birth',
  citations: 'any',
  hasProposals: false,
  complGte: null,
};

function personNode(data: Partial<PersonNodeData> & { id: string }): Node {
  return {
    id: data.id,
    type: 'person',
    position: { x: 0, y: 0 },
    data: {
      givenName: data.givenName ?? data.id,
      surname: data.surname ?? '',
      sex: data.sex ?? 'U',
      isLiving: data.isLiving ?? true,
      label: `${data.givenName ?? data.id} ${data.surname ?? ''}`.trim(),
      ...data,
      id: data.id,
    } as PersonNodeData,
  };
}

function dimmedIds(nodes: Node[]): string[] {
  return nodes
    .filter((n) => (n.data as PersonNodeData).dimmed)
    .map((n) => n.id);
}

describe('applyFilters — no filters active', () => {
  it('does not dim any node when every dimension is at its default', () => {
    const nodes = [
      personNode({ id: 'a', sex: 'M', isLiving: true }),
      personNode({ id: 'b', sex: 'F', isLiving: false }),
      personNode({ id: 'c', sex: 'U', isLiving: true }),
    ];
    const out = applyFilters(nodes, NO_FILTERS);
    expect(dimmedIds(out)).toEqual([]);
  });

  it('passes draft nodes through untouched', () => {
    const draft: Node = {
      id: 'draft-1',
      type: 'draftPerson',
      position: { x: 0, y: 0 },
      data: {},
    };
    const out = applyFilters([draft], { ...NO_FILTERS, sex: ['F'] });
    expect(out[0]).toBe(draft);
  });
});

describe('applyFilters — sex', () => {
  const nodes = [
    personNode({ id: 'm', sex: 'M' }),
    personNode({ id: 'f', sex: 'F' }),
    personNode({ id: 'u', sex: 'U' }),
  ];

  it('with all 3 selected behaves like no filter', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, sex: ['M', 'F', 'U'] });
    expect(dimmedIds(out)).toEqual([]);
  });

  it('dims sexes not in the selected array', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, sex: ['M'] });
    expect(dimmedIds(out).sort()).toEqual(['f', 'u']);
  });
});

describe('applyFilters — living', () => {
  const nodes = [
    personNode({ id: 'live', isLiving: true }),
    personNode({ id: 'dead', isLiving: false }),
  ];

  it('living=["living"] dims deceased', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, living: ['living'] });
    expect(dimmedIds(out)).toEqual(['dead']);
  });

  it('living=["deceased"] dims living', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, living: ['deceased'] });
    expect(dimmedIds(out)).toEqual(['live']);
  });

  it('living with both selected dims neither', () => {
    const out = applyFilters(nodes, {
      ...NO_FILTERS,
      living: ['living', 'deceased'],
    });
    expect(dimmedIds(out)).toEqual([]);
  });
});

describe('applyFilters — validation', () => {
  const nodes = [
    personNode({ id: 'conf', validation: 'confirmed' }),
    personNode({ id: 'prop', validation: 'proposed' }),
  ];

  it('validation=["confirmed"] dims proposed', () => {
    const out = applyFilters(nodes, {
      ...NO_FILTERS,
      validation: ['confirmed'],
    });
    expect(dimmedIds(out)).toEqual(['prop']);
  });
});

describe('applyFilters — year ranges', () => {
  const nodes = [
    personNode({ id: 'old', birthDate: '1850-03-12' }),
    personNode({ id: 'mid', birthDate: '1925' }),
    personNode({ id: 'young', birthDate: '2005-01-01' }),
    personNode({ id: 'undated' }),
    personNode({ id: 'fuzzy', birthDate: 'about 1900' }),
  ];

  it('bornFrom alone trims earlier nodes; undated passes', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, bornFrom: 1900 });
    expect(dimmedIds(out).sort()).toEqual(['old']);
  });

  it('bornTo alone trims later nodes; undated passes', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, bornTo: 1950 });
    expect(dimmedIds(out).sort()).toEqual(['young']);
  });

  it('bornFrom + bornTo restricts to a window; fuzzy "about 1900" passes', () => {
    const out = applyFilters(nodes, {
      ...NO_FILTERS,
      bornFrom: 1880,
      bornTo: 1950,
    });
    expect(dimmedIds(out).sort()).toEqual(['old', 'young']);
  });

  it('died range respects deathDate independently', () => {
    const dn = [
      personNode({ id: 'd1', deathDate: '1900' }),
      personNode({ id: 'd2', deathDate: '2000' }),
      personNode({ id: 'd3' }), // alive / no deathDate
    ];
    const out = applyFilters(dn, {
      ...NO_FILTERS,
      diedFrom: 1950,
      diedTo: 2050,
    });
    expect(dimmedIds(out)).toEqual(['d1']);
  });
});

describe('applyFilters — place', () => {
  const nodes = [
    personNode({ id: 'mos', birthPlace: 'Moscow, Russia' }),
    personNode({ id: 'spb', birthPlace: 'Saint Petersburg' }),
    personNode({ id: 'noplace' }),
  ];

  it('substring-matches case-insensitively against birthPlace', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, place: 'moscow' });
    expect(dimmedIds(out).sort()).toEqual(['noplace', 'spb']);
  });

  it('whitespace-only place is treated as no filter', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, place: '   ' });
    expect(dimmedIds(out)).toEqual([]);
  });
});

describe('applyFilters — citations', () => {
  const nodes = [
    personNode({ id: 'zero', sourcesCount: 0 }),
    personNode({ id: 'one', sourcesCount: 1 }),
    personNode({ id: 'two', sourcesCount: 2 }),
    personNode({ id: 'five', sourcesCount: 5 }),
    personNode({ id: 'unset' }),
  ];

  it('"none" passes only nodes with 0 sources (and undefined defaults to 0)', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, citations: 'none' });
    expect(dimmedIds(out).sort()).toEqual(['five', 'one', 'two']);
  });

  it('"gte1" passes nodes with at least 1', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, citations: 'gte1' });
    expect(dimmedIds(out).sort()).toEqual(['unset', 'zero']);
  });

  it('"gte3" passes nodes with at least 3', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, citations: 'gte3' });
    expect(dimmedIds(out).sort()).toEqual(['one', 'two', 'unset', 'zero']);
  });
});

describe('applyFilters — completeness', () => {
  const nodes = [
    personNode({ id: 'p20', completeness: 20 }),
    personNode({ id: 'p50', completeness: 50 }),
    personNode({ id: 'p80', completeness: 80 }),
    personNode({ id: 'unset' }),
  ];

  it('complGte=50 dims < 50 (and treats undefined as 0)', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, complGte: 50 });
    expect(dimmedIds(out).sort()).toEqual(['p20', 'unset']);
  });
});

describe('applyFilters — hasProposals', () => {
  const nodes = [
    personNode({ id: 'has' }),
    personNode({ id: 'has-not' }),
  ];

  it('with no proposedPersonIds set provided, the filter is a silent no-op', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, hasProposals: true });
    expect(dimmedIds(out)).toEqual([]);
  });

  it('with a set, only members pass', () => {
    const out = applyFilters(
      nodes,
      { ...NO_FILTERS, hasProposals: true },
      new Set(['has']),
    );
    expect(dimmedIds(out)).toEqual(['has-not']);
  });

  it('hasProposals=false passes everyone regardless of set membership', () => {
    const out = applyFilters(
      nodes,
      { ...NO_FILTERS, hasProposals: false },
      new Set(['has']),
    );
    expect(dimmedIds(out)).toEqual([]);
  });
});

describe('applyFilters — q (free-text)', () => {
  const nodes = [
    personNode({ id: 'a', givenName: 'Alice', surname: 'Smith' }),
    personNode({ id: 'b', givenName: 'Bob', surname: 'Jones' }),
    personNode({ id: 'c', givenName: 'Charlie', surname: 'Smith' }),
  ];

  it('matches case-insensitively across givenName + surname', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, q: 'smith' });
    expect(dimmedIds(out)).toEqual(['b']);
  });

  it('matches across the space (givenName + surname)', () => {
    const out = applyFilters(nodes, { ...NO_FILTERS, q: 'alice smith' });
    expect(dimmedIds(out).sort()).toEqual(['b', 'c']);
  });
});

describe('applyFilters — composition', () => {
  it('dims a node failing any single dimension', () => {
    const nodes = [
      personNode({
        id: 'pass',
        sex: 'F',
        isLiving: true,
        birthDate: '1980',
        sourcesCount: 5,
      }),
      personNode({
        id: 'wrong-sex',
        sex: 'M',
        isLiving: true,
        birthDate: '1980',
        sourcesCount: 5,
      }),
      personNode({
        id: 'wrong-year',
        sex: 'F',
        isLiving: true,
        birthDate: '1850',
        sourcesCount: 5,
      }),
    ];
    const out = applyFilters(nodes, {
      ...NO_FILTERS,
      sex: ['F'],
      bornFrom: 1900,
      citations: 'gte1',
    });
    expect(dimmedIds(out).sort()).toEqual(['wrong-sex', 'wrong-year']);
  });
});

describe('matchesCanvasFilters — direct boolean usage', () => {
  it('exposes the predicate for callers that need a boolean rather than a node array', () => {
    const data = {
      id: 'x',
      givenName: 'X',
      surname: 'Y',
      sex: 'M',
      isLiving: true,
      label: 'X Y',
    } as PersonNodeData;
    expect(matchesCanvasFilters(data, NO_FILTERS)).toBe(true);
    expect(matchesCanvasFilters(data, { ...NO_FILTERS, sex: ['F'] })).toBe(false);
  });
});
