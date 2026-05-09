/**
 * Dashboard v2 feature flag.
 *
 * Phase 6 made v2 the only path: legacy `DashboardBody` is deleted and the
 * v1 branch in `dashboard/page.tsx` is gone. The flag now defaults to ON and
 * exists only as an emergency opt-out — set `NEXT_PUBLIC_DASHBOARD_V2=false`
 * to render an empty dashboard body (the parallel-route slots short-circuit).
 *
 * That's an *explicit* "something's wrong, get me out" mode rather than a
 * usable fallback. A future cleanup release removes the flag and its branches
 * entirely; see ADR-018.
 */
export function isDashboardV2Enabled(): boolean {
  const v = process.env.NEXT_PUBLIC_DASHBOARD_V2;
  // Default ON — only the explicit string "false" or "0" disables.
  if (v === 'false' || v === '0') return false;
  return true;
}
