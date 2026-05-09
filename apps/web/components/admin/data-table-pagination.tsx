import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  basePath: string;
  q?: string;
  offset: number;
  limit: number;
  total: number;
}

function buildHref(basePath: string, q: string | undefined, offset: number) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (offset > 0) params.set('offset', String(offset));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function DataTablePagination({ basePath, q, offset, limit, total }: Props) {
  const t = useTranslations('admin.dataTable');
  if (total <= limit) return null;

  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const prev = Math.max(0, offset - limit);
  const next = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = next < total;

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground tabular-nums">
        {t('pageOf', { page, pageCount })}
      </p>
      <div className="flex gap-2">
        <Button
          asChild={hasPrev}
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          aria-label={t('previousAriaLabel')}
        >
          {hasPrev ? (
            <Link href={buildHref(basePath, q, prev)}>
              <ChevronLeft className="size-4" />
              {t('previous')}
            </Link>
          ) : (
            <span>
              <ChevronLeft className="size-4" />
              {t('previous')}
            </span>
          )}
        </Button>
        <Button
          asChild={hasNext}
          variant="outline"
          size="sm"
          disabled={!hasNext}
          aria-label={t('nextAriaLabel')}
        >
          {hasNext ? (
            <Link href={buildHref(basePath, q, next)}>
              {t('next')}
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span>
              {t('next')}
              <ChevronRight className="size-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
