import { describe, it, expect } from 'vitest';
import {
  ROLE_RANK,
  isStrictlyBelow,
  availableLenses,
  effectiveRole,
} from '../src/lens';

describe('ROLE_RANK', () => {
  it('orders roles viewer < editor < admin < owner', () => {
    expect(ROLE_RANK.viewer).toBeLessThan(ROLE_RANK.editor);
    expect(ROLE_RANK.editor).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.owner);
  });
});

describe('isStrictlyBelow', () => {
  it('returns true when candidate is lower-ranked than actual', () => {
    expect(isStrictlyBelow('viewer', 'editor')).toBe(true);
    expect(isStrictlyBelow('editor', 'admin')).toBe(true);
    expect(isStrictlyBelow('admin', 'owner')).toBe(true);
    expect(isStrictlyBelow('viewer', 'owner')).toBe(true);
  });

  it('returns false when candidate equals actual', () => {
    expect(isStrictlyBelow('admin', 'admin')).toBe(false);
    expect(isStrictlyBelow('viewer', 'viewer')).toBe(false);
  });

  it('returns false when candidate is higher-ranked than actual (escalation)', () => {
    expect(isStrictlyBelow('owner', 'admin')).toBe(false);
    expect(isStrictlyBelow('admin', 'editor')).toBe(false);
    expect(isStrictlyBelow('editor', 'viewer')).toBe(false);
  });
});

describe('availableLenses', () => {
  it('owner can lens to admin, editor, viewer', () => {
    expect(availableLenses('owner')).toEqual(['admin', 'editor', 'viewer']);
  });

  it('admin can lens to editor, viewer', () => {
    expect(availableLenses('admin')).toEqual(['editor', 'viewer']);
  });

  it('editor can lens only to viewer', () => {
    expect(availableLenses('editor')).toEqual(['viewer']);
  });

  it('viewer has no available lenses', () => {
    expect(availableLenses('viewer')).toEqual([]);
  });
});

describe('effectiveRole', () => {
  it('returns actual role when no lens requested', () => {
    expect(effectiveRole('admin', null)).toBe('admin');
    expect(effectiveRole('owner', null)).toBe('owner');
  });

  it('applies legitimate downgrade', () => {
    expect(effectiveRole('owner', 'viewer')).toBe('viewer');
    expect(effectiveRole('admin', 'editor')).toBe('editor');
    expect(effectiveRole('editor', 'viewer')).toBe('viewer');
  });

  it('rejects escalation request and returns actual role', () => {
    expect(effectiveRole('viewer', 'editor')).toBe('viewer');
    expect(effectiveRole('editor', 'admin')).toBe('editor');
    expect(effectiveRole('admin', 'owner')).toBe('admin');
  });

  it('rejects same-role request (no-op) and returns actual role', () => {
    expect(effectiveRole('admin', 'admin')).toBe('admin');
    expect(effectiveRole('viewer', 'viewer')).toBe('viewer');
  });
});
