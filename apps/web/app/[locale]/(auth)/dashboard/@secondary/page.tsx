import { setRequestLocale } from 'next-intl/server';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';
import { isDashboardV2Enabled } from '@/lib/flags/dashboard-v2';
import type { Locale } from '@/i18n/routing';
import { ContributionQueue } from '@/components/moderation/contribution-queue';
import { FactsheetsRecent } from '@/components/dashboard/factsheets-recent';
import { FeaturedAncestorCard } from '@/components/dashboard/featured-ancestor-card';

/**
 * @secondary slot — Phase 4.
 *
 * Composition by effective role:
 *   - Owner (with `contributions:review`) → ContributionQueue (queue lives
 *     here for owners; admin's queue is promoted to @primary).
 *   - Editor (with `ai:research`) → FactsheetsRecent.
 *   - Viewer → FeaturedAncestorCard (deterministic daily rotation).
 *   - Admin / Other → null.
 *
 * Empty-tree case is suppressed at the layout level; each branch still
 * short-circuits defensively. `FeaturedAncestorCard` self-suppresses when
 * the family has no deceased persons, so a viewer with only living relatives
 * sees an empty secondary slot rather than an empty card.
 */
export default async function SecondarySlot({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isDashboardV2Enabled()) return null;

  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { totalPersons } = await getCachedStatCards(ctx.dbFilename);
  if (totalPersons === 0) return null;

  if (ctx.role === 'viewer') {
    return <FeaturedAncestorCard dbFilename={ctx.dbFilename} familyId={ctx.familyId} />;
  }

  if (ctx.role === 'editor' && hasPermission(ctx.role, 'ai:research')) {
    return <FactsheetsRecent dbFilename={ctx.dbFilename} />;
  }

  if (ctx.role === 'owner' && hasPermission(ctx.role, 'contributions:review')) {
    return (
      <div id="contribution-queue" className="scroll-mt-4">
        <ContributionQueue familyId={ctx.familyId} />
      </div>
    );
  }

  return null;
}
