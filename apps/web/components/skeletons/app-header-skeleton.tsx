import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export function AppHeaderSkeleton() {
  // Mirrors app-header.tsx structure exactly to avoid CLS when chrome streams in.
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Skeleton className="-ml-1 size-7 rounded-md" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-20 rounded-md" />
      <Skeleton className="size-8 rounded-md" />
    </header>
  );
}
