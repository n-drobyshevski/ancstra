import { redirect } from 'next/navigation';
import { hasPermission, type Permission } from '@ancstra/auth';
import { requireAuthContext, type AuthContext } from '@/lib/auth/context';

/**
 * Guard for RSC pages: ensures the caller holds `permission` against the
 * effective (lens-aware) role. On miss, server-redirects to `fallback` with a
 * `?denied=<permission>` search param so the client `<AccessDeniedToast>` can
 * surface a single toast and strip the param from the URL.
 *
 * Returns the auth context on success so callers don't double-fetch:
 *
 *     export default async function Page() {
 *       const ctx = await requirePagePermission('members:manage');
 *       // ...use ctx.familyId / ctx.dbFilename
 *     }
 *
 * Server-side enforcement is the source of truth (tRPC `protectedProcedure`
 * still runs its own permissionMiddleware); this guard only governs whether
 * the page should render at all.
 */
export async function requirePagePermission(
  permission: Permission,
  fallback: string = '/dashboard',
): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  if (!hasPermission(ctx.role, permission)) {
    const sep = fallback.includes('?') ? '&' : '?';
    redirect(`${fallback}${sep}denied=${encodeURIComponent(permission)}`);
  }
  return ctx;
}

/**
 * Like `requirePagePermission`, but accepts multiple permissions and passes
 * if the user holds AT LEAST ONE of them. Used for pages whose tabs/sections
 * map to different perms but where any of them grants access (e.g. `/data`
 * rendered as long as the user can import OR export).
 */
export async function requirePagePermissionAny(
  permissions: readonly Permission[],
  fallback: string = '/dashboard',
): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  const ok = permissions.some((p) => hasPermission(ctx.role, p));
  if (!ok) {
    const sep = fallback.includes('?') ? '&' : '?';
    // Surface the first missing permission so the toast names something
    // meaningful; the user only needed one of them, but reporting the first
    // is a reasonable signal for "you can't see this page".
    redirect(`${fallback}${sep}denied=${encodeURIComponent(permissions[0])}`);
  }
  return ctx;
}
