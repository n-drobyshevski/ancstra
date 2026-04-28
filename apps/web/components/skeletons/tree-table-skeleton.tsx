import { Skeleton } from '@/components/ui/skeleton';

// Fallback for /tree?view=table. Toolbar strip + ~10 row placeholders sized
// to roughly match the comfortable-density TreeTable so layout shift is
// minimal when rows stream in.
export function TreeTableSkeleton() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md hidden sm:block" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md hidden md:block" />
        </div>
      </div>

      {/* Table card */}
      <div className="flex-1 min-h-0 rounded-md border overflow-hidden">
        {/* Header strip */}
        <div className="border-b bg-muted/30 px-4 py-2.5 flex gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24 hidden sm:block" />
          <Skeleton className="h-4 w-12 hidden md:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
          <Skeleton className="h-4 w-32 hidden lg:block" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex gap-4 items-center">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20 hidden sm:block" />
              <Skeleton className="h-2 w-2 rounded-full hidden md:block" />
              <Skeleton className="h-4 w-24 hidden md:block" />
              <Skeleton className="h-4 w-32 hidden lg:block" />
              <Skeleton className="ml-auto h-4 w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer status */}
      <div className="flex items-center justify-between text-sm">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}
