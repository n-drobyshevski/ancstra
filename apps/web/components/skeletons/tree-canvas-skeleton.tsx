import { Skeleton } from '@/components/ui/skeleton';

// Tree route fallback. Mirrors the canvas viewport — a top toolbar strip plus
// a few node-sized placeholders arranged like a small genealogy lineage. Sized
// to fill the available height so the LCP element doesn't shift when the real
// canvas mounts.
export function TreeCanvasSkeleton() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col gap-4">
      {/* Toolbar strip */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="hidden h-9 w-32 rounded-md sm:block" />
        </div>
      </div>

      {/* Canvas area with placeholder nodes */}
      <div className="relative flex-1 overflow-hidden rounded-lg border bg-muted/30">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 p-8">
          {/* Top row — grandparents */}
          <div className="flex gap-12">
            <Skeleton className="h-20 w-44 rounded-lg" />
            <Skeleton className="h-20 w-44 rounded-lg" />
          </div>
          {/* Middle row — parents */}
          <div className="flex gap-8">
            <Skeleton className="h-20 w-44 rounded-lg" />
            <Skeleton className="h-20 w-44 rounded-lg" />
          </div>
          {/* Bottom row — children */}
          <div className="flex gap-6">
            <Skeleton className="h-20 w-40 rounded-lg" />
            <Skeleton className="h-20 w-40 rounded-lg" />
            <Skeleton className="h-20 w-40 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
