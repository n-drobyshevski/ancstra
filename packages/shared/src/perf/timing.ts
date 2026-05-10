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
  let invoked = false;
  try {
    return await Sentry.startSpan({ name, attributes: attrs }, async () => {
      invoked = true;
      return fn();
    });
  } catch (err) {
    if (invoked) throw err;          // fn already ran and threw — propagate
    return fn() as Promise<T>;        // Sentry wrapper failed before invoking — safe to retry
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
  let invoked = false;
  try {
    return Sentry.startSpan({ name, attributes: attrs, op: 'db.query' }, () => {
      invoked = true;
      return fn();
    });
  } catch (err) {
    if (invoked) throw err;          // fn already ran and threw — propagate
    return fn();                      // Sentry wrapper failed before invoking — safe to retry
  }
}
