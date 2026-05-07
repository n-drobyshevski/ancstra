import { describe, it, expect } from 'vitest';
import { hasPermission } from '../src/permissions';
import type { Role, Permission } from '../src/types';
import { VALID_ROLES } from '../src/types';

const ALL_PERMISSIONS: Permission[] = [
  'tree:view', 'tree:export', 'tree:delete',
  'person:create', 'person:edit', 'person:delete',
  'family:create', 'family:edit', 'family:delete',
  'event:create', 'event:edit', 'event:delete',
  'source:create', 'source:edit', 'source:delete',
  'media:upload', 'media:delete',
  'gedcom:import', 'gedcom:export',
  'ai:research',
  'relationship:validate',
  'members:manage', 'members:invite', 'members:transfer-ownership',
  'settings:manage',
  'contributions:review',
  'activity:view',
];

const ADMIN_EXCLUDED = new Set<Permission>([
  'settings:manage',
  'tree:delete',
  'members:transfer-ownership',
]);

const EDITOR_PERMISSIONS = new Set<Permission>([
  'tree:view', 'tree:export',
  'person:create', 'person:edit',
  'family:create', 'family:edit',
  'event:create', 'event:edit',
  'source:create', 'source:edit',
  'media:upload',
  'gedcom:export',
  'ai:research',
  'relationship:validate',
  'activity:view',
]);

const VIEWER_PERMISSIONS = new Set<Permission>(['tree:view', 'activity:view']);

const EXPECTED_MATRIX: Record<Role, Set<Permission>> = {
  owner: new Set(ALL_PERMISSIONS),
  admin: new Set(ALL_PERMISSIONS.filter((p) => !ADMIN_EXCLUDED.has(p))),
  editor: EDITOR_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
};

describe('permission matrix — exhaustive cells', () => {
  for (const role of VALID_ROLES) {
    describe(`role: ${role}`, () => {
      for (const perm of ALL_PERMISSIONS) {
        const expected = EXPECTED_MATRIX[role].has(perm);
        it(`${role} ${expected ? 'has' : 'does not have'} ${perm}`, () => {
          expect(hasPermission(role, perm)).toBe(expected);
        });
      }
    });
  }
});

describe('permission matrix — invariants', () => {
  it('owner has every permission', () => {
    expect(EXPECTED_MATRIX.owner.size).toBe(ALL_PERMISSIONS.length);
    for (const perm of ALL_PERMISSIONS) {
      expect(hasPermission('owner', perm)).toBe(true);
    }
  });

  it('admin has all permissions except 3 owner-only ones', () => {
    expect(EXPECTED_MATRIX.admin.size).toBe(ALL_PERMISSIONS.length - 3);
    for (const excluded of ADMIN_EXCLUDED) {
      expect(hasPermission('admin', excluded)).toBe(false);
    }
  });

  it('viewer permissions are a strict subset of editor permissions', () => {
    expect(EXPECTED_MATRIX.viewer.size).toBeLessThan(EXPECTED_MATRIX.editor.size);
    for (const perm of EXPECTED_MATRIX.viewer) {
      expect(EXPECTED_MATRIX.editor.has(perm)).toBe(true);
    }
  });

  it('editor permissions are a strict subset of admin permissions', () => {
    expect(EXPECTED_MATRIX.editor.size).toBeLessThan(EXPECTED_MATRIX.admin.size);
    for (const perm of EXPECTED_MATRIX.editor) {
      expect(EXPECTED_MATRIX.admin.has(perm)).toBe(true);
    }
  });
});
