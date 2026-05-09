import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedStatCards } from '@/lib/cache/dashboard';
import { isDashboardV2Enabled } from '@/lib/flags/dashboard-v2';
import { selectHeroVariant } from '@/lib/dashboard/hero-variant';
import { selectStatKeys } from '@/lib/dashboard/stat-cards';
import { Button } from '@/components/ui/button';
import { WelcomeCard } from '@/components/onboarding/welcome-card';
import { RoleGate } from '@/components/auth/role-gate';
import { DashboardCount } from '@/components/dashboard/dashboard-count';
import { StatCards } from '@/components/dashboard/stat-cards';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { FamilyHealthHero } from '@/components/dashboard/family-health-hero';
import { ModerationHero } from '@/components/dashboard/moderation-hero';
import { ResearchFocusHero } from '@/components/dashboard/research-focus-hero';
import { ExploreHero } from '@/components/dashboard/explore-hero';
import { DashboardCountSkeleton } from '@/components/skeletons/dashboard-count-skeleton';
import { StatCardsSkeleton } from '@/components/skeletons/stat-cards-skeleton';

/**
 * @hero slot — Phase 4.
 *
 * Composition:
 *   - Owner → FamilyHealthHero (members + invites + governance shortcuts)
 *   - Admin (with `contributions:review`) → ModerationHero
 *   - Editor (with `ai:research`) → ResearchFocusHero
 *   - Viewer → ExploreHero (read-only entry points)
 *   - Other / no-perm → fall through to the generic intro band
 *
 * WelcomeCard is hidden for viewers (Phase 4): the card's CTAs (import/add/
 * research) are all RoleGate'd to nothing for viewers, so historically it
 * would render as title+tagline with zero buttons — confusing dead UI. The
 * ExploreHero replaces it as the viewer's orientation surface.
 *
 * StatCards + QuickActions only render when the tree isn't empty (same as v1).
 */
export default async function HeroSlot() {
  if (!isDashboardV2Enabled()) return null;

  const ctx = await getAuthContext();
  if (!ctx) return null;
  const { totalPersons } = await getCachedStatCards(ctx.dbFilename);
  const t = await getTranslations('dashboard');

  const variant = selectHeroVariant(ctx.role);
  const heroCard =
    variant === 'family-health'
      ? <FamilyHealthHero familyId={ctx.familyId} />
      : variant === 'moderation' && hasPermission(ctx.role, 'contributions:review')
        ? <ModerationHero dbFilename={ctx.dbFilename} />
        : variant === 'research-focus' && hasPermission(ctx.role, 'ai:research')
          ? <ResearchFocusHero dbFilename={ctx.dbFilename} userId={ctx.userId} />
          : variant === 'explore'
            ? <ExploreHero dbFilename={ctx.dbFilename} />
            : null;

  // Viewers don't see the WelcomeCard — every CTA inside is gated to nothing.
  const showWelcomeCard = ctx.role !== 'viewer';

  return (
    <div className="space-y-4 md:space-y-6">
      {showWelcomeCard && <WelcomeCard />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <Suspense fallback={<DashboardCountSkeleton />}>
            <DashboardCount />
          </Suspense>
        </div>
        <RoleGate permission="person:create">
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/persons/new">{t('addNewPerson')}</Link>
          </Button>
        </RoleGate>
      </div>
      {heroCard}
      {totalPersons > 0 && (
        <>
          <Suspense fallback={<StatCardsSkeleton />}>
            <StatCards dbFilename={ctx.dbFilename} keys={selectStatKeys(ctx.role)} />
          </Suspense>
          <QuickActions />
        </>
      )}
    </div>
  );
}
