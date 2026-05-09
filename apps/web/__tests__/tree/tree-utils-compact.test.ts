import { describe, it, expect } from 'vitest';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  COMPACT_NODE_WIDTH,
  COMPACT_NODE_HEIGHT,
  applyDagreLayout,
  parseLayoutData,
  serializeLayoutData,
  tightenRankSpacing,
  relaxOverlapsByRank,
  rescaleSpacingByMode,
} from '../../components/tree/tree-utils';
import type { Node, Edge } from '@xyflow/react';

describe('node dimension constants', () => {
  it('exports wide (default) dimensions', () => {
    expect(NODE_WIDTH).toBe(240);
    expect(NODE_HEIGHT).toBe(70);
  });

  it('exports compact dimensions', () => {
    expect(COMPACT_NODE_WIDTH).toBe(120);
    expect(COMPACT_NODE_HEIGHT).toBe(80);
  });
});

function makeNodes(count: number): Node[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    type: 'person',
    position: { x: 0, y: 0 },
    data: { label: `Person ${i}` },
  }));
}

describe('applyDagreLayout with nodeStyle', () => {
  it('produces tighter vertical spacing with compact style', () => {
    const nodes = makeNodes(2);
    const edges: Edge[] = [
      { id: 'e1', type: 'parentChild', source: 'p0', target: 'p1' },
    ];

    const wideResult = applyDagreLayout(nodes, edges, undefined, 'wide');
    const compactResult = applyDagreLayout(nodes, edges, undefined, 'compact');

    expect(compactResult).toHaveLength(2);

    const wideGapY = Math.abs(wideResult[1].position.y - wideResult[0].position.y);
    const compactGapY = Math.abs(compactResult[1].position.y - compactResult[0].position.y);
    expect(compactGapY).toBeLessThan(wideGapY);
  });

  it('uses compact partner gap for partner edges', () => {
    const nodes = makeNodes(2);
    const edges: Edge[] = [
      { id: 'partner-f1', type: 'partner', source: 'p0', target: 'p1',
        sourceHandle: 'right', targetHandle: 'left', data: { familyId: 'f1' } },
    ];

    const compactResult = applyDagreLayout(nodes, edges, undefined, 'compact');
    const gap = Math.abs(compactResult[1].position.x - compactResult[0].position.x);
    expect(gap).toBe(144);
  });
});

describe('layout data serialization', () => {
  it('parses legacy format (flat positions record)', () => {
    const legacy = JSON.stringify({ p1: { x: 10, y: 20 }, p2: { x: 30, y: 40 } });
    const result = parseLayoutData(legacy);
    expect(result.positions).toEqual({ p1: { x: 10, y: 20 }, p2: { x: 30, y: 40 } });
    expect(result.nodeStyle).toBeUndefined();
  });

  it('parses new format with nodeStyle', () => {
    const data = JSON.stringify({
      positions: { p1: { x: 10, y: 20 } },
      nodeStyle: 'compact',
    });
    const result = parseLayoutData(data);
    expect(result.positions).toEqual({ p1: { x: 10, y: 20 } });
    expect(result.nodeStyle).toBe('compact');
  });

  it('serializes positions only — node-style preference lives outside the layout', () => {
    const positions = { p1: { x: 10, y: 20 }, p2: { x: 30, y: 40 } };
    const json = serializeLayoutData(positions);
    const parsed = JSON.parse(json);
    expect(parsed.positions).toEqual(positions);
    expect(parsed.nodeStyle).toBeUndefined();
  });
});

describe('tightenRankSpacing (wide → compact compression)', () => {
  function rankNodes(...positions: number[]): Node[] {
    return positions.map((x, i) => ({
      id: `p${i}`,
      type: 'person',
      position: { x, y: 0 },
      data: { label: `Person ${i}` },
    }));
  }

  it('pulls excess gaps closed when switching to compact mode', () => {
    // 3 nodes laid out for wide mode at stride = NODE_WIDTH(240) + 80 = 320.
    const nodes = rankNodes(0, 320, 640);
    const out = tightenRankSpacing(nodes, [], 'compact');
    // Compact stride = COMPACT_NODE_WIDTH(120) + 50 = 170. Center preserved
    // around 320 → leftmost ≈ 320 - 170 = 150, rightmost ≈ 320 + 170 = 490.
    const xs = out.map((n) => n.position.x);
    const center = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(center).toBeCloseTo(320, 5); // original center preserved
    expect(xs[1] - xs[0]).toBe(170); // exact stride between siblings
    expect(xs[2] - xs[1]).toBe(170);
  });

  it('uses compact partnerGap (24) for partner-pair adjacency', () => {
    const nodes = rankNodes(0, 280); // wide partner pair: 240 + 40 = 280 stride
    const edges: Edge[] = [
      {
        id: 'partner-f1',
        type: 'partner',
        source: 'p0',
        target: 'p1',
        sourceHandle: 'right',
        targetHandle: 'left',
        data: { familyId: 'f1' },
      },
    ];
    const out = tightenRankSpacing(nodes, edges, 'compact');
    const dx = out[1].position.x - out[0].position.x;
    expect(dx).toBe(COMPACT_NODE_WIDTH + 24); // 144 — compact pair stride
  });

  it('is a no-op when gaps are already at expected spacing', () => {
    // Already at compact stride (170).
    const nodes = rankNodes(100, 270, 440);
    const out = tightenRankSpacing(nodes, [], 'compact');
    expect(out.map((n) => n.position.x)).toEqual([100, 270, 440]);
  });

  it('does not push apart — overlaps stay; relax handles the other direction', () => {
    // Nodes already overlapping for wide mode (only 100px apart, less than
    // wide stride 320). tightenRankSpacing must NOT pull them further; that
    // would deepen the overlap.
    const nodes = rankNodes(0, 100);
    const out = tightenRankSpacing(nodes, [], 'wide');
    // Both X positions unchanged (no excess to pull).
    expect(out[0].position.x).toBe(0);
    expect(out[1].position.x).toBe(100);
  });

  it('composed with relax → exact spacing in both directions', () => {
    // 3 nodes that are too close for wide mode (overlapping).
    const nodes = rankNodes(0, 100, 200);
    const wideOut = tightenRankSpacing(
      relaxOverlapsByRank(nodes, [], 'wide'),
      [],
      'wide',
    );
    // After relax+tighten in wide mode: stride = 320, center preserved (~100).
    const wideXs = wideOut.map((n) => n.position.x);
    expect(wideXs[1] - wideXs[0]).toBe(NODE_WIDTH + 80); // 320
    expect(wideXs[2] - wideXs[1]).toBe(NODE_WIDTH + 80);
  });

  it('preserves the rank center after compression', () => {
    // Wide-mode positions, far from origin, to verify rank doesn't drift.
    const nodes = rankNodes(1000, 1320, 1640);
    const origCenter = (1000 + 1640) / 2; // 1320
    const out = tightenRankSpacing(nodes, [], 'compact');
    const xs = out.map((n) => n.position.x);
    const newCenter = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(newCenter).toBeCloseTo(origCenter, 5);
  });
});

describe('rescaleSpacingByMode (preserves cross-rank alignment)', () => {
  function pn(id: string, x: number, y: number): Node {
    return {
      id,
      type: 'person',
      position: { x, y },
      data: { label: id },
    };
  }

  it('returns input unchanged when fromStyle === toStyle', () => {
    const nodes = [pn('a', 100, 0), pn('b', 420, 0)];
    const out = rescaleSpacingByMode(nodes, 'wide', 'wide');
    expect(out).toBe(nodes);
  });

  it('shrinks sibling stride from wide to compact (320 → 170)', () => {
    // Two siblings at wide stride; pivot is their midpoint.
    const nodes = [pn('a', 0, 0), pn('b', 320, 0)];
    const out = rescaleSpacingByMode(nodes, 'wide', 'compact');
    const dx = out[1].position.x - out[0].position.x;
    expect(dx).toBeCloseTo(170, 5);
  });

  it('grows sibling stride from compact to wide (170 → 320)', () => {
    const nodes = [pn('a', 0, 0), pn('b', 170, 0)];
    const out = rescaleSpacingByMode(nodes, 'compact', 'wide');
    const dx = out[1].position.x - out[0].position.x;
    expect(dx).toBeCloseTo(320, 5);
  });

  it('preserves the relative offset between every pair of nodes', () => {
    // Multi-rank fixture: granddad alone above dad, dad in a pair with mom,
    // 3 kids below. After rescale, the offsets between any two nodes must
    // scale by the same factor (170/320), so a parent stays vertically
    // aligned with its child.
    const nodes = [
      pn('granddad', 640, 0),
      pn('mom', 360, 200),
      pn('dad', 640, 200),
      pn('k1', 180, 400),
      pn('k2', 500, 400),
      pn('k3', 820, 400),
    ];
    const out = rescaleSpacingByMode(nodes, 'wide', 'compact');
    const factor = 170 / 320;

    const at = (id: string) => out.find((n) => n.id === id)!.position.x;

    // Granddad and dad were at the same X — they MUST still be aligned.
    expect(at('granddad')).toBeCloseTo(at('dad'), 5);

    // Pairwise offsets all scaled by the same factor.
    const origGranddadDad = 640 - 640;
    expect(at('granddad') - at('dad')).toBeCloseTo(origGranddadDad * factor, 5);

    const origMomK1 = 360 - 180;
    expect(at('mom') - at('k1')).toBeCloseTo(origMomK1 * factor, 5);

    const origDadK3 = 640 - 820;
    expect(at('dad') - at('k3')).toBeCloseTo(origDadK3 * factor, 5);
  });

  it('keeps single-node ranks aligned with their multi-node neighbors', () => {
    // Reproduces the screenshot bug: granddad is alone at the top rank
    // (Y=0). With per-rank tighten + re-center, granddad doesn't move
    // because his rank has length 1, so he ends up stranded above where
    // his son USED to be. With rescale, he moves with the rest of the
    // canvas.
    const nodes = [
      pn('granddad', 640, 0),
      pn('mom', 360, 200),
      pn('dad', 640, 200),
    ];
    const out = rescaleSpacingByMode(nodes, 'wide', 'compact');
    const at = (id: string) => out.find((n) => n.id === id)!.position.x;

    // Granddad still directly above dad (offset 0).
    expect(at('granddad') - at('dad')).toBeCloseTo(0, 5);
  });

  it('leaves Y coordinates unchanged', () => {
    const nodes = [pn('a', 0, 100), pn('b', 320, 200)];
    const out = rescaleSpacingByMode(nodes, 'wide', 'compact');
    expect(out[0].position.y).toBe(100);
    expect(out[1].position.y).toBe(200);
  });
});
