import { Skeleton } from '@/components/ui/skeleton';

// Layout-shaped skeleton matching the real shell so the page doesn't
// reflow when threads arrive. Mirrors the lg: split-pane: list on the
// left, preview placeholder on the right.
export function ThreadListSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex-1 overflow-hidden rounded-lg border border-border">
        <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ul className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="space-y-2 rounded border border-border p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </li>
            ))}
          </ul>
          <div className="hidden border-l border-border p-4 lg:block">
            <Skeleton className="mb-3 h-5 w-1/2" />
            <Skeleton className="mb-2 h-3 w-full" />
            <Skeleton className="mb-2 h-3 w-5/6" />
            <Skeleton className="mb-2 h-3 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
