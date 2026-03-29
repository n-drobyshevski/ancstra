import { describe, it, expect } from 'vitest';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  COMPACT_NODE_WIDTH,
  COMPACT_NODE_HEIGHT,
  type NodeStyle,
} from '../../components/tree/tree-utils';

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
