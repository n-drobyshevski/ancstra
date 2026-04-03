import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ContributionQueue } from '@/components/moderation/contribution-queue';
import { WelcomeCard } from '@/components/onboarding/welcome-card';
import { getCachedDashboardData } from '@/lib/cached-queries';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';

import { StatCards } from '@/components/dashboard/stat-cards';
import { RecentPersons } from '@/components/dashboard/recent-persons';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { QualityWidget } from '@/components/dashboard/quality-widget';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { EmptyDashboard } from '@/components/dashboard/empty-dashboard';
import { MobileAddButton } from '@/components/dashboard/mobile-add-button';

export default async function DashboardPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const canReview = hasPermission(authContext.role, 'contributions:review');

  const {
    recentPersons,
    totalPersons,
    totalFamilies,
    recentAdditionsCount,
    overallQualityScore,
  } = await getCachedDashboardData(authContext.dbFilename);

  return (
    <PagePadding>
      <div className="space-y-4 md:space-y-6">
        <WelcomeCard />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Welcome to Ancstra</h1>
            <p className="text-sm text-muted-foreground">
              {totalPersons} {totalPersons === 1 ? 'person' : 'people'} in your
              tree.
            </p>
          </div>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/persons/new">Add New Person</Link>
          </Button>
        </div>

        {totalPersons === 0 ? (
          <EmptyDashboard />
        ) : (
          <>
            {/* Stats row */}
            <StatCards
              totalPersons={totalPersons}
              totalFamilies={totalFamilies}
              overallQualityScore={overallQualityScore}
              recentAdditionsCount={recentAdditionsCount}
            />

            {/* Quick actions */}
            <QuickActions />

            {/* Main content grid */}
            <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_320px]">
              {/* Left: Recent Persons */}
              <RecentPersons
                persons={recentPersons}
                totalPersons={totalPersons}
              />

              {/* Right: Quality + Activity */}
              <div className="space-y-4 md:space-y-6">
                <QualityWidget score={overallQualityScore} />

                <RecentActivity familyId={authContext.familyId} />
              </div>
            </div>

            {/* Pending Reviews (conditional) */}
            {canReview && (
              <ContributionQueue familyId={authContext.familyId} />
            )}
          </>
        )}
      </div>

      {/* Mobile floating action button */}
      <MobileAddButton />
    </PagePadding>
  );
}
