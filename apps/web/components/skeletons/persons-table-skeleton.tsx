import { Skeleton } from '@/components/ui/skeleton';

// Table-shaped placeholder: toolbar row + 10 rows + pagination footer. Sized
// to roughly match what the real PersonsDataTable will render so layout
// shift is minimal when the data streams in.
export function PersonsTableSkeleton() {
  return (
    <div className="space-y-3 min-w-0">
      {/* Toolbar row (mobile drawer + columns dropdown) */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-24 md:hidden" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="border-b px-4 py-3 flex gap-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24 hidden sm:block" />
          <Skeleton className="h-4 w-24 hidden md:block" />
          <Skeleton className="h-4 w-20 hidden lg:block" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-4 items-center">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20 hidden sm:block" />
              <Skeleton className="h-4 w-28 hidden md:block" />
              <Skeleton className="h-4 w-16 hidden lg:block" />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between text-sm">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  );
}
