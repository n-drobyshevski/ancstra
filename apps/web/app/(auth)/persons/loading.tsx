import { PagePadding } from '@/components/page-padding';
import { PersonsSidebarSkeleton } from '@/components/skeletons/persons-sidebar-skeleton';
import { PersonsTableSkeleton } from '@/components/skeletons/persons-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Route-level fallback — mirrors the streamed shell layout exactly so a
// soft navigation lands in a consistent skeleton.
export default function Loading() {
  return (
    <PagePadding>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
          <PersonsSidebarSkeleton />
          <PersonsTableSkeleton />
        </div>
      </div>
    </PagePadding>
  );
}
