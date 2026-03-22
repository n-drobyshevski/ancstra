import { type Role, type Permission, ForbiddenError } from './types';

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
  'members:manage', 'members:invite',
  'settings:manage',
  'contributions:review',
  'activity:view',
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(p => p !== 'settings:manage' && p !== 'tree:delete'),
  editor: [
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
  ],
  viewer: ['tree:view', 'activity:view'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(permission);
  }
}

export function shouldModerate(role: Role, moderationEnabled: boolean): boolean {
  return role === 'editor' && moderationEnabled;
}
