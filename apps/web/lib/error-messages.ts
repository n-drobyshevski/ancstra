import { ForbiddenError } from '@ancstra/auth';
import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';

const PERMISSION_KEYS = [
  'person:delete',
  'person:edit',
  'person:create',
  'settings:manage',
  'members:manage',
  'tree:delete',
  'gedcom:import',
  'gedcom:export',
  'ai:research',
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];
type PermissionTranslator = (key: PermissionKey | 'fallback') => string;
type ErrorTranslator = (key: 'generic' | 'notAuthenticated' | 'network' | 'databaseBusy' | 'forbidden', values?: Record<string, string>) => string;

function isKnownPermission(p: string): p is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(p);
}

function describePermission(permission: string, tPerm: PermissionTranslator): string {
  return isKnownPermission(permission) ? tPerm(permission) : tPerm('fallback');
}

function classify(
  error: unknown,
  tErr: ErrorTranslator,
  tPerm: PermissionTranslator,
): string {
  if (error instanceof ForbiddenError) {
    return tErr('forbidden', { action: describePermission(error.permission, tPerm) });
  }
  if (error instanceof Error) {
    if (error.message.includes('Not authenticated')) return tErr('notAuthenticated');
    if (error.message.includes('fetch') || error.message.includes('network')) return tErr('network');
    if (error.message.includes('SQLITE_BUSY')) return tErr('databaseBusy');
  }
  return tErr('generic');
}

/**
 * Server-side: translate an arbitrary error into a user-friendly string.
 * Pulls translations from `errors.*` and `errors.permissions.*`.
 */
export async function getUserFriendlyError(error: unknown): Promise<string> {
  const tErr = await getTranslations('errors');
  const tPerm = await getTranslations('errors.permissions');
  return classify(error, tErr as ErrorTranslator, tPerm as PermissionTranslator);
}

/**
 * Client-side hook: returns a fn that translates an arbitrary error into
 * a user-friendly string. Use inside try/catch handlers in 'use client'
 * components.
 */
export function useFriendlyErrorTranslator(): (error: unknown) => string {
  const tErr = useTranslations('errors');
  const tPerm = useTranslations('errors.permissions');
  return (error) => classify(error, tErr as ErrorTranslator, tPerm as PermissionTranslator);
}
