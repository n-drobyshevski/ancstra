import { describe, it, expect } from 'vitest';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  COMPACT_NODE_WIDTH,
  COMPACT_NODE_HEIGHT,
  applyDagreLayout,
  parseLayoutData,
  serializeLayoutData,
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
