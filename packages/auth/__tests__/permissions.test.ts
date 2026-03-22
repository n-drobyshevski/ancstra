import { describe, it, expect } from 'vitest';
import { hasPermission, requirePermission, shouldModerate } from '../src/permissions';
import { ForbiddenError } from '../src/types';

describe('hasPermission', () => {
  it('owner has all permissions', () => {
    expect(hasPermission('owner', 'settings:manage')).toBe(true);
    expect(hasPermission('owner', 'tree:delete')).toBe(true);
    expect(hasPermission('owner', 'person:delete')).toBe(true);
  });

  it('admin has all except settings:manage and tree:delete', () => {
    expect(hasPermission('admin', 'person:delete')).toBe(true);
    expect(hasPermission('admin', 'members:manage')).toBe(true);
    expect(hasPermission('admin', 'settings:manage')).toBe(false);
    expect(hasPermission('admin', 'tree:delete')).toBe(false);
  });

  it('editor can create/edit but not delete or manage', () => {
    expect(hasPermission('editor', 'person:create')).toBe(true);
    expect(hasPermission('editor', 'person:edit')).toBe(true);
    expect(hasPermission('editor', 'person:delete')).toBe(false);
    expect(hasPermission('editor', 'members:manage')).toBe(false);
    expect(hasPermission('editor', 'gedcom:import')).toBe(false);
  });

  it('viewer can only view tree and activity', () => {
    expect(hasPermission('viewer', 'tree:view')).toBe(true);
    expect(hasPermission('viewer', 'activity:view')).toBe(true);
    expect(hasPermission('viewer', 'person:create')).toBe(false);
    expect(hasPermission('viewer', 'tree:export')).toBe(false);
  });
});

describe('requirePermission', () => {
  it('throws ForbiddenError when permission missing', () => {
    expect(() => requirePermission('viewer', 'person:edit')).toThrow(ForbiddenError);
  });
  it('does not throw when permission exists', () => {
    expect(() => requirePermission('owner', 'person:edit')).not.toThrow();
  });
});

describe('shouldModerate', () => {
  it('returns true for editor when moderation enabled', () => {
    expect(shouldModerate('editor', true)).toBe(true);
  });
  it('returns false for editor when moderation disabled', () => {
    expect(shouldModerate('editor', false)).toBe(false);
  });
  it('returns false for owner even when moderation enabled', () => {
    expect(shouldModerate('owner', true)).toBe(false);
  });
  it('returns false for admin even when moderation enabled', () => {
    expect(shouldModerate('admin', true)).toBe(false);
  });
});
