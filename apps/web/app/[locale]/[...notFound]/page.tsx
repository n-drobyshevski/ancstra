import { notFound } from 'next/navigation';

/**
 * Catch-all 404 fallback for any unmatched path under a valid locale segment.
 *
 * Without this, Next.js's natural unmatched-route handling falls through to
 * its built-in <DefaultLayout> + <NotAllowedRootHTTPFallbackError> for paths
 * like `/researchs` (which next-intl middleware rewrites to `/en/researchs`,
 * but no `[locale]/researchs/page.tsx` exists). That bypasses
 * `[locale]/layout.tsx` entirely — so the user loses the
 * `<html suppressHydrationWarning>` wrapper (browser extensions like
 * LanguageTool then trip a hydration warning) AND the designed
 * `[locale]/not-found.tsx` UI never gets rendered.
 *
 * Calling `notFound()` from this catch-all forces Next.js to render the
 * closest `not-found.tsx` walking up — which is `[locale]/not-found.tsx`,
 * inside `[locale]/layout.tsx`. The user sees the styled 404 and the
 * extension hydration warning is suppressed.
 *
 * Specific routes (e.g. `(auth)/research/page.tsx`) always win over this
 * catch-all, so legitimate routes are unaffected. See vercel/next.js#54980
 * for the underlying issue this works around.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
