/**
 * Validate a callbackUrl-style redirect target. Returns the input only if
 * it's a same-origin relative path. Returns null for any URL that could
 * navigate the user off-origin (open redirect) or trigger a non-http scheme.
 *
 * Safe forms:
 *   /dashboard
 *   /join?token=abc
 *   /dashboard#anchor
 *
 * Unsafe forms (rejected):
 *   //evil.com/foo            — protocol-relative
 *   https://evil.com/foo      — absolute
 *   javascript:alert(1)       — non-http scheme
 *   /\evil.com                — backslash trickery (some browsers normalize)
 *   dashboard, ./, ../        — not anchored at /
 */
export function safeCallbackPath(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  if (input.length === 0) return null;

  // Must start with a single forward slash.
  if (!input.startsWith('/')) return null;

  // Reject protocol-relative URLs ("//host/...").
  if (input.startsWith('//')) return null;

  // Reject backslash-prefixed paths — some browsers normalize "/\\foo" into
  // "//foo" and treat it as protocol-relative.
  if (input.startsWith('/\\')) return null;

  // Reject embedded scheme separators.
  if (input.includes('://')) return null;

  return input;
}
