import { Skeleton } from '@/components/ui/skeleton';
import { FactsheetSidebarSkeleton } from './factsheet-sidebar-skeleton';
import { FactsheetDetailSkeleton } from './factsheet-detail-skeleton';

export function FactsheetsShellSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        {/* Desktop: 2-column split */}
        <div className="hidden h-full md:grid md:grid-cols-[280px_1fr]">
          <FactsheetSidebarSkeleton />
          <div className="flex flex-col overflow-hidden">
            <div className="flex h-10 items-center gap-2 border-b border-border bg-background px-4">
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="flex-1 overflow-y-auto">
              <FactsheetDetailSkeleton />
            </div>
          </div>
        </div>

        {/* Mobile: just the sidebar list */}
        <div className="flex h-full md:hidden">
          <FactsheetSidebarSkeleton />
        </div>
      </div>
    </div>
  );
}
