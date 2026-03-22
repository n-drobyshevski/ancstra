'use client';

import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ScrapeStatusProps {
  status: 'idle' | 'scraping' | 'done' | 'error';
  title?: string;
  snippet?: string;
  error?: string;
}

export function ScrapeStatus({ status, title, snippet, error }: ScrapeStatusProps) {
  if (status === 'idle') return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
      {status === 'scraping' && (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin text-primary mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Scraping page...</p>
          </div>
        </>
      )}

      {status === 'done' && (
        <>
          <CheckCircle2 className="size-4 shrink-0 text-green-500 mt-0.5" />
          <div className="min-w-0">
            {title && (
              <p className="text-sm font-medium truncate">{title}</p>
            )}
            {snippet && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {snippet}
              </p>
            )}
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">
              {error ?? 'Failed to scrape page'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
