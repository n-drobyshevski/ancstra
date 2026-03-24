'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ResearchItemError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Failed to load this research item.
      </p>
      <div className="mt-4 flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/research">Go back to Research</Link>
        </Button>
      </div>
    </div>
  );
}
