import { Skeleton } from '@/components/ui/skeleton';

export function ActivityEntrySkeleton() {
  return (
    <div className="flex items-start gap-3 py-3 px-2">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
