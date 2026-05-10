import { InviteAcceptedToast } from '@/components/dashboard/invite-accepted-toast';

/**
 * Dashboard page — v2 final form.
 *
 * The visual surface is composed by `dashboard/layout.tsx` from the
 * @hero / @primary / @aside / @secondary parallel-route slots. This page
 * hosts only the page-level affordances that don't belong to any visual
 * region:
 *   - InviteAcceptedToast — fires a one-shot toast after invite acceptance,
 *     renders no UI.
 *
 * The mobile FAB now lives in `(auth)/layout.tsx` as `ContextualFab` so it
 * appears on every authenticated route that registers an action — no per-page
 * mounting required.
 *
 * If `NEXT_PUBLIC_DASHBOARD_V2=false` is set as an emergency opt-out, the
 * layout returns just `{children}` and this page renders only the toast —
 * an explicit "something is broken, surface as little as possible"
 * mode rather than a graceful fallback. See ADR-018.
 */
export default function DashboardPage() {
  return (
    <>
      <InviteAcceptedToast />
    </>
  );
}
