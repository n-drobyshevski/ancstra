import { isDashboardV2Enabled } from '@/lib/flags/dashboard-v2';
import { PagePadding } from '@/components/page-padding';

/**
 * Dashboard layout — sync wrapper for parallel-route slots.
 *
 * No top-level awaits: the original v1 page.tsx had a deliberate comment
 * about avoiding them, and Next.js 16 cacheComponents prefers dynamic data
 * to live inside Suspense'd children rather than block layout rendering.
 *
 * Empty-tree collapse: handled inside @primary (which renders EmptyDashboard
 * full-width on its own). The 2-col grid stays mounted; @aside / @secondary
 * self-suppress to null when the tree is empty so the right column collapses
 * to whitespace. EmptyDashboard's centered design tolerates a narrow column.
 */
export default function DashboardLayout({
  children,
  hero,
  primary,
  aside,
  secondary,
}: LayoutProps<'/[locale]/dashboard'>) {
  if (!isDashboardV2Enabled()) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Page-level affordances render unwrapped (FAB is position:fixed). */}
      {children}
      <PagePadding>
        <div className="space-y-4 md:space-y-6">
          {hero}
          <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-4 md:space-y-6">{primary}</div>
            <div className="space-y-4 md:space-y-6">{aside}</div>
          </div>
          {secondary}
        </div>
      </PagePadding>
    </>
  );
}
