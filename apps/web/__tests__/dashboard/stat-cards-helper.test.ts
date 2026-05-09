import { describe, it, expect } from 'vitest';
import { selectStatKeys } from '@/lib/dashboard/stat-cards';

describe('selectStatKeys', () => {
  it('returns the canonical 4 KPIs for owner', () => {
    expect(selectStatKeys('owner')).toEqual([
      'people',
      'families',
      'dataQuality',
      'last30Days',
    ]);
  });

  it('replaces families with pendingContributions for admin', () => {
    const keys = selectStatKeys('admin');
    expect(keys).toContain('pendingContributions');
    expect(keys).not.toContain('families');
    expect(keys).toEqual([
      'people',
      'pendingContributions',
      'dataQuality',
      'last30Days',
    ]);
  });

  it('leads with quality for editor and drops to 3 cards', () => {
    expect(selectStatKeys('editor')).toEqual(['dataQuality', 'people', 'last30Days']);
  });

  it('returns just 2 cards for viewer (no quality)', () => {
    const keys = selectStatKeys('viewer');
    expect(keys).toEqual(['people', 'last30Days']);
    expect(keys).not.toContain('dataQuality');
  });

  it('returns the default 4 when role is null', () => {
    expect(selectStatKeys(null)).toEqual([
      'people',
      'families',
      'dataQuality',
      'last30Days',
    ]);
  });

  it('caps every role at 4 keys', () => {
    for (const role of ['owner', 'admin', 'editor', 'viewer'] as const) {
      expect(selectStatKeys(role).length).toBeLessThanOrEqual(4);
    }
  });

  it('lens-as-viewer flips an owner to the viewer 2-card stat row', () => {
    // Effective-role contract: caller passes `ctx.role` (lens-aware), not actual.
    expect(selectStatKeys('viewer')).toEqual(['people', 'last30Days']);
  });
});
