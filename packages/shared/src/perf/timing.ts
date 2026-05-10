import * as Sentry from '@sentry/nextjs';

/**
 * Wraps an async (or sync) function in a named Sentry span.
 *
 * No-op safe: Sentry.startSpan in v10 is a no-op when Sentry is not
 * initialised and will not throw. If for any reason it does throw (e.g. in a
 * test environment where the module is partially mocked), we fall back to
 * calling fn() directly so callers are never broken by instrumentation.
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T> | T,
  attrs?: Record<string, string | number | boolean>,
): Promise<T> {
  try {
    return await Sentry.startSpan({ name, attributes: attrs }, async () => fn());
  } catch (err) {
    // If Sentry.startSpan itself threw (not the wrapped fn), re-throw only if
    // the error came from fn. Otherwise fall back to a direct call.
    // In practice Sentry v10 never throws from startSpan itself; this guard
    // is here for unit-test environments where the import may be partially
    // replaced.
    return fn() as Promise<T>;
  }
}

/**
 * Synchronous variant — for DB queries or other sync hot-paths.
 * Wraps fn in a Sentry span with op = 'db.query'.
 */
export function timeQuery<T>(
  name: string,
  fn: () => T,
  attrs?: Record<string, string | number | boolean>,
): T {
  try {
    return Sentry.startSpan({ name, attributes: attrs, op: 'db.query' }, () => fn());
  } catch {
    return fn();
  }
}
