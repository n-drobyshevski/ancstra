import { Skeleton } from '@/components/ui/skeleton';

export function FactsheetSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col border-r border-border bg-muted/20">
      <div className="space-y-2 border-b border-border p-3">
        <Skeleton className="h-9 w-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-6 w-14" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5 rounded-md border border-border p-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
