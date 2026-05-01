import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  basePath: string;
  q: string;
  total: number;
  placeholder?: string;
}

/**
 * Plain `<form method="get">` search — server component, no client JS needed.
 * Submits to `basePath?q=...&offset=0` so a new search resets pagination.
 */
export function DataTableToolbar({ basePath, q, total, placeholder = 'Search…' }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form action={basePath} method="get" className="flex gap-2 max-w-md flex-1">
        <input type="hidden" name="offset" value="0" />
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            aria-hidden
          />
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={placeholder}
            aria-label="Search"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {q ? (
          <Button asChild variant="ghost">
            <Link href={basePath}>Clear</Link>
          </Button>
        ) : null}
      </form>
      <p className="text-sm text-muted-foreground tabular-nums">
        {total.toLocaleString()} {total === 1 ? 'result' : 'results'}
      </p>
    </div>
  );
}
