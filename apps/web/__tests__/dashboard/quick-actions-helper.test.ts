import { describe, it, expect } from 'vitest';
import {
  selectQuickActionKeys,
  QUICK_ACTION_PERMISSIONS,
} from '@/lib/dashboard/quick-actions';

describe('selectQuickActionKeys', () => {
  it('returns 4 actions including Invite for owner', () => {
    const keys = selectQuickActionKeys('owner');
    expect(keys).toEqual(['addPerson', 'importData', 'aiResearch', 'inviteMember']);
    expect(keys).toContain('inviteMember');
  });

  it('returns 4 actions including Invite for admin', () => {
    const keys = selectQuickActionKeys('admin');
    expect(keys).toEqual(['addPerson', 'importData', 'aiResearch', 'inviteMember']);
  });

  it('returns 4 actions for editor (importData self-suppresses via perm filter)', () => {
    // The helper returns 4 keys; the component filters by permission. Editor
    // lacks gedcom:import — that's the layer responsible for hiding the tile.
    expect(selectQuickActionKeys('editor')).toEqual([
      'addPerson',
      'importData',
      'aiResearch',
      'viewTree',
    ]);
  });

  it('returns empty list for viewer (ExploreHero handles entry points)', () => {
    expect(selectQuickActionKeys('viewer')).toEqual([]);
  });

  it('returns empty list when role is null', () => {
    expect(selectQuickActionKeys(null)).toEqual([]);
  });

  it('caps every role at 4 actions', () => {
    for (const role of ['owner', 'admin', 'editor', 'viewer'] as const) {
      expect(selectQuickActionKeys(role).length).toBeLessThanOrEqual(4);
    }
  });

  it('inviteMember sits ahead of viewTree for owner/admin (priority over the redundant tree link)', () => {
    for (const role of ['owner', 'admin'] as const) {
      const keys = selectQuickActionKeys(role);
      const idx = keys.indexOf('inviteMember');
      const treeIdx = keys.indexOf('viewTree');
      expect(idx).toBeGreaterThanOrEqual(0);
      // viewTree may be absent entirely; if present, invite must precede it.
      if (treeIdx >= 0) expect(idx).toBeLessThan(treeIdx);
    }
  });

  it('declares a permission for every action key (catalog completeness)', () => {
    for (const role of ['owner', 'admin', 'editor', 'viewer'] as const) {
      for (const key of selectQuickActionKeys(role)) {
        expect(QUICK_ACTION_PERMISSIONS[key]).toBeDefined();
      }
    }
  });
});
