import { ForbiddenError } from '@ancstra/auth';

export function getUserFriendlyError(error: unknown): string {
  if (error instanceof ForbiddenError) {
    return `You don't have permission to ${describePermission(error.permission)}. Contact a family admin.`;
  }
  if (error instanceof Error) {
    if (error.message.includes('Not authenticated')) return 'Please sign in to continue.';
    if (error.message.includes('fetch') || error.message.includes('network'))
      return 'Unable to connect. Check your internet connection.';
    if (error.message.includes('SQLITE_BUSY')) return 'Database is busy. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

function describePermission(permission: string): string {
  const map: Record<string, string> = {
    'person:delete': 'delete this person',
    'person:edit': 'edit this person',
    'person:create': 'add new persons',
    'settings:manage': 'change settings',
    'members:manage': 'manage family members',
    'tree:delete': 'delete this family tree',
    'gedcom:import': 'import GEDCOM files',
    'gedcom:export': 'export data',
    'ai:research': 'use AI research features',
  };
  return map[permission] || 'perform this action';
}
