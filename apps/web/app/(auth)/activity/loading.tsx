import { Skeleton } from '@/components/ui/skeleton';
import { PagePadding } from '@/components/page-padding';

export default function ActivityLoading() {
  return (
    <PagePadding>
      <div className="space-y-4">
        {/* Title */}
        <Skeleton className="h-8 w-32" />

        {/* Filter tabs skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-md" />
          ))}
        </div>

        {/* Date group header */}
        <Skeleton className="h-3 w-16" />

        {/* Activity entries */}
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 py-3 px-2">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PagePadding>
  );
}
