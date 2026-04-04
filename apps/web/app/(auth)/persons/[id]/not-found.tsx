import Link from 'next/link';
import { PagePadding } from '@/components/page-padding';

export default function PersonNotFound() {
  return (
    <PagePadding>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-lg font-semibold">Person not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This person may have been deleted or you may not have access.
        </p>
        <Link href="/persons" className="mt-4 text-sm text-primary hover:underline">
          Back to all persons
        </Link>
      </div>
    </PagePadding>
  );
}
