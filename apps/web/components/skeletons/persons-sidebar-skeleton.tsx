import { Skeleton } from '@/components/ui/skeleton';

// 9 facet placeholders matching the real sidebar layout (search + 8 facet
// rows). Sticky 16rem container so the skeleton occupies the same column
// the real sidebar will land in.
export function PersonsSidebarSkeleton() {
  return (
    <div className="hidden md:block">
      <div className="rounded-md border bg-card sticky top-4 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col">
        <aside aria-label="Loading filters" className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-3 p-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
