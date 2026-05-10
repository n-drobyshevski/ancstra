import { TRPCClientError } from '@trpc/client';

export type ErrorClassification =
  | 'forbidden'
  | 'unauthorized'
  | 'offline'
  | 'generic';

const FORBIDDEN_PATTERNS =
  /\b(FORBIDDEN|forbidden|Permission denied|insufficient (?:permissions|privileges)|access denied)\b/i;
const UNAUTHORIZED_PATTERNS =
  /\b(UNAUTHORIZED|Not authenticated|sign[- ]in required|session (?:expired|missing))\b/i;
const OFFLINE_PATTERNS =
  /\b(fetch failed|Failed to fetch|NetworkError|ECONNREFUSED|ETIMEDOUT|net::ERR_)/i;

/**
 * Classify an error into one of four buckets so the right error page shell
 * can be picked. We can't always rely on the original message in production
 * (Server Component errors are forwarded to the client with a sanitized
 * message), so callers can override the classification via the `classifyAs`
 * prop on `<RouteError>` when they know what to expect from a route.
 */
export function classifyError(
  error: Error & { digest?: string; name?: string; data?: unknown },
): ErrorClassification {
  if (error instanceof TRPCClientError) {
    const code = (error.data as { code?: string } | undefined)?.code;
    if (code === 'FORBIDDEN') return 'forbidden';
    if (code === 'UNAUTHORIZED') return 'unauthorized';
  }

  if (error.name === 'ForbiddenError') return 'forbidden';

  const message = error.message ?? '';
  if (FORBIDDEN_PATTERNS.test(message)) return 'forbidden';
  if (UNAUTHORIZED_PATTERNS.test(message)) return 'unauthorized';
  if (OFFLINE_PATTERNS.test(message)) return 'offline';

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }

  return 'generic';
}
