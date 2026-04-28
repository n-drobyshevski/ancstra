import { Skeleton } from '@/components/ui/skeleton';

export function FactsheetDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-4 w-full max-w-md" />

      <div className="space-y-2 pt-2">
        <Skeleton className="h-5 w-20" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2">
        <Skeleton className="h-5 w-16" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border p-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
