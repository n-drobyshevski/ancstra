import * as React from "react"

/**
 * Viewport breakpoints. Aligned with the Tailwind v4 tokens defined in
 * `apps/web/app/globals.css`:
 *   xs ≥ 480px,  sm ≥ 640px,  md ≥ 768px,  lg ≥ 1024px,  xl ≥ 1280px.
 *
 * `isMobile` is "below md" (the same threshold the original `useIsMobile`
 * returned), so existing callsites continue to behave identically.
 */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

export interface Viewport {
  /** Below md (< 768px). */
  isMobile: boolean
  /** md to lg (768px – 1023px). */
  isTablet: boolean
  /** lg and up (≥ 1024px). */
  isDesktop: boolean
  /**
   * Current largest matched breakpoint, or `undefined` before mount.
   * Treat `undefined` as "no information yet" — render the desktop fallback,
   * since SSR has no viewport context anyway.
   */
  breakpoint: Breakpoint | undefined
}

const QUERIES: Record<Breakpoint, string> = {
  xs: `(min-width: ${BREAKPOINTS.xs}px)`,
  sm: `(min-width: ${BREAKPOINTS.sm}px)`,
  md: `(min-width: ${BREAKPOINTS.md}px)`,
  lg: `(min-width: ${BREAKPOINTS.lg}px)`,
  xl: `(min-width: ${BREAKPOINTS.xl}px)`,
}

const ORDER: Breakpoint[] = ["xs", "sm", "md", "lg", "xl"]

function snapshotBreakpoint(): Breakpoint | undefined {
  if (typeof window === "undefined") return undefined
  let result: Breakpoint | undefined
  for (const bp of ORDER) {
    if (window.matchMedia(QUERIES[bp]).matches) result = bp
  }
  return result
}

/**
 * Returns viewport classification. SSR-safe: returns isMobile=false during
 * server render and the very first client render, then flips post-mount.
 *
 * Renders all consumers when *any* breakpoint boundary is crossed (single
 * subscription per breakpoint, shared via a module-level listener pool would
 * be possible but unnecessary here — these listeners are essentially free).
 */
export function useViewport(): Viewport {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint | undefined>(
    undefined,
  )
  // Distinguishes "before mount" (SSR / first client render — no info, must
  // report desktop to keep SSR HTML stable) from "after mount and no min-width
  // query matched" (viewport is narrower than xs/480px — modern phones in
  // portrait fall here: iPhone 14 = 390px, Pixel 7 = 412px, iPhone 15 Pro Max
  // = 430px). Without this flag the latter collapses into the former and the
  // mobile sidebar trigger silently no-ops.
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
    setBreakpoint(snapshotBreakpoint())

    const mqls = ORDER.map((bp) => window.matchMedia(QUERIES[bp]))
    const onChange = () => setBreakpoint(snapshotBreakpoint())

    for (const mql of mqls) mql.addEventListener("change", onChange)
    return () => {
      for (const mql of mqls) mql.removeEventListener("change", onChange)
    }
  }, [])

  const isMobile = !hasMounted
    ? false
    : breakpoint === undefined
      ? true
      : !["md", "lg", "xl"].includes(breakpoint)
  const isTablet = breakpoint === "md"
  const isDesktop = breakpoint === "lg" || breakpoint === "xl"

  return { isMobile, isTablet, isDesktop, breakpoint }
}

/**
 * Backward-compatible thin re-export. Callers that only care about "below md"
 * can keep importing this; `useIsMobile()` still resolves to `false` during
 * SSR and the very first client render.
 */
export function useIsMobile(): boolean {
  return useViewport().isMobile
}
