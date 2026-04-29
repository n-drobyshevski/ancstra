import { describe, it, expect } from 'vitest';
import { getParentChildEdgePath } from '../../components/tree/parent-child-edge';

const args = { sourceX: 0, sourceY: 0, targetX: 100, targetY: 100 };

describe('getParentChildEdgePath', () => {
  it('returns a non-empty SVG path for each style', () => {
    for (const style of ['curved', 'stepped', 'straight'] as const) {
      const d = getParentChildEdgePath(style, args);
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);
      // SVG path data starts with a move command.
      expect(d.startsWith('M')).toBe(true);
    }
  });

  it('produces three visually distinct paths', () => {
    const curved = getParentChildEdgePath('curved', args);
    const stepped = getParentChildEdgePath('stepped', args);
    const straight = getParentChildEdgePath('straight', args);
    expect(curved).not.toBe(stepped);
    expect(curved).not.toBe(straight);
    expect(stepped).not.toBe(straight);
  });

  it("'straight' is a single-segment 'M ... L ...' line", () => {
    const d = getParentChildEdgePath('straight', args);
    // Straight path uses one moveto + one lineto, no curves or multi-segment steps.
    expect(d).toMatch(/^M[^A-Z]*L[^A-Z]*$/);
  });

  it("'stepped' has degenerate corner curves (borderRadius 0)", () => {
    const d = getParentChildEdgePath('stepped', args);
    // borderRadius:0 still emits Q commands, but the control point coincides
    // with the end point so corners are visually sharp. Each Q triplet has the
    // shape "Q X,Y X,Y" (control == end).
    const qs = d.match(/Q\s*([\d.-]+),([\d.-]+)\s+([\d.-]+),([\d.-]+)/g);
    expect(qs).not.toBeNull();
    for (const q of qs!) {
      const m = q.match(/Q\s*([\d.-]+),([\d.-]+)\s+([\d.-]+),([\d.-]+)/);
      expect(m).not.toBeNull();
      const [, cx, cy, ex, ey] = m!;
      expect(cx).toBe(ex);
      expect(cy).toBe(ey);
    }
  });

  it("'curved' has non-degenerate corner curves (borderRadius > 0)", () => {
    const d = getParentChildEdgePath('curved', args);
    const m = d.match(/Q\s*([\d.-]+),([\d.-]+)\s+([\d.-]+),([\d.-]+)/);
    expect(m).not.toBeNull();
    const [, cx, cy, ex, ey] = m!;
    // At least one of the curve's control coords differs from the end coords.
    expect(cx !== ex || cy !== ey).toBe(true);
  });

  it("defaults to 'curved' when no style is provided (preserves today's look)", () => {
    const undef = getParentChildEdgePath(undefined, args);
    const curved = getParentChildEdgePath('curved', args);
    expect(undef).toBe(curved);
  });
});
