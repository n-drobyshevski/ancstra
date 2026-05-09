import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';
import { isDashboardV2Enabled } from '@/lib/flags/dashboard-v2';
import { PagePadding } from '@/components/page-padding';

/**
 * Dashboard layout — Phase 1 of the v2 redesign.
 *
 * Two paths:
 *  - Flag OFF (current behavior): pass through `children` unchanged. Slots
 *    are still mounted by Next.js but each slot's `page.tsx` short-circuits
 *    to `null` so this codepath has no extra render cost.
 *  - Flag ON: assemble the role-aware bento (hero / primary / aside / secondary).
 *    `children` becomes the host for page-level affordances (toast + FAB).
 *
 * Empty-tree handling matches v1 verbatim: when totalPersons === 0 we collapse
 * to a single column and render only `@primary` (which itself returns
 * EmptyDashboard) — no aside, no secondary, no 2-col grid.
 *
 * Phase 6 removes the flag and the v1 branch.
 */
export default async function DashboardLayout({
  children,
  hero,
  primary,
  aside,
  secondary,
}: {
  children: React.ReactNode;
  hero: React.ReactNode;
  primary: React.ReactNode;
  aside: React.ReactNode;
  secondary: React.ReactNode;
}) {
  if (!isDashboardV2Enabled()) {
    // Legacy path — page.tsx renders the entire dashboard.
    return <>{children}</>;
  }

  // V2 path — slot-based composition.
  // Read empty state at layout level so we can collapse the 2-col grid to a
  // single column. Hits the same `getCachedStatCards` cache as the slots.
  const ctx = await getAuthContext();
  const totalPersons = ctx ? (await getCachedStatCards(ctx.dbFilename)).totalPersons : 0;
  const isEmpty = totalPersons === 0;

  return (
    <>
      {/* Page-level affordances render unwrapped (FAB is position:fixed). */}
      {children}
      <PagePadding>
        <div className="space-y-4 md:space-y-6">
          {hero}
          {isEmpty ? (
            // Single column — primary slot renders EmptyDashboard full-width.
            primary
          ) : (
            <>
              <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_320px]">
                <div className="min-w-0 space-y-4 md:space-y-6">{primary}</div>
                <div className="space-y-4 md:space-y-6">{aside}</div>
              </div>
              {secondary}
            </>
          )}
        </div>
      </PagePadding>
    </>
  );
}
