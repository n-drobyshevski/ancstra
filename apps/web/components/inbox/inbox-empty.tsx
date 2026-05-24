import Link from 'next/link';
import { Inbox as InboxIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InboxEmptyProps {
  locale: string;
}

export function InboxEmpty({ locale }: InboxEmptyProps) {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <InboxIcon className="mb-4 size-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">All clear</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        Nothing pending. Generate hints, open the factsheets workspace, or browse your tree.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link href={`${prefix}/research`}>Research workspace</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`${prefix}/tree`}>Browse tree</Link>
        </Button>
      </div>
    </div>
  );
}
