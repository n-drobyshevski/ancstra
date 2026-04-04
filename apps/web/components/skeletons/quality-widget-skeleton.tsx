import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function QualityWidgetSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}
