import { StatCardsSkeleton } from '@/components/skeletons/stat-cards-skeleton';
import { RecentPersonsSkeleton } from '@/components/skeletons/recent-persons-skeleton';
import { QualityWidgetSkeleton } from '@/components/skeletons/quality-widget-skeleton';
import { RecentActivitySkeleton } from '@/components/skeletons/recent-activity-skeleton';

export function DashboardBodySkeleton() {
  return (
    <>
      <StatCardsSkeleton />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_320px]">
        <RecentPersonsSkeleton />
        <div className="space-y-4 md:space-y-6">
          <QualityWidgetSkeleton />
          <RecentActivitySkeleton />
        </div>
      </div>
    </>
  );
}
