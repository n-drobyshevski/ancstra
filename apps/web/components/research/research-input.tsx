'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, Link, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScrapeUrl } from '@/lib/research/scrape-client';

const URL_REGEX = /^https?:\/\//;

interface ResearchInputProps {
  onSearch: (query: string) => void;
  onSaved?: () => void;
  onOpenTextModal?: () => void;
  placeholder?: string;
  externalQuery?: string;
}

export function ResearchInput({
  onSearch,
  onSaved,
  onOpenTextModal,
  placeholder = 'Search records or paste a URL...',
  externalQuery,
}: ResearchInputProps) {
  const [value, setValue] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const { scrape, status, result, error, isLoading } = useScrapeUrl();

  // Sync external query (e.g. from example search clicks)
  useEffect(() => {
    if (externalQuery != null) setValue(externalQuery);
  }, [externalQuery]);

  // Auto-detect URL vs search
  useEffect(() => {
    const trimmed = value.trim();
    setIsUrlMode(URL_REGEX.test(trimmed));
  }, [value]);

  // Submit search on Enter or button click
  const handleSubmitSearch = useCallback(() => {
    if (isUrlMode) return;
    onSearch(value.trim());
  }, [value, isUrlMode, onSearch]);

  const handleScrape = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const res = await scrape(trimmed);
    if (res) {
      onSaved?.();
    }
  }, [value, scrape, onSaved]);

  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
  }, [onSearch]);

  const isDone = status === 'done';
  const hasValue = value.length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitSearch(); }}
          placeholder={placeholder}
          className="pl-9 pr-24"
          disabled={isLoading}
          aria-label="Search records or paste a URL"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
          {hasValue && !isUrlMode ? (
            <button
              type="button"
              onClick={handleSubmitSearch}
              className="rounded-md bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              disabled={isLoading}
              aria-label="Search"
            >
              Search
            </button>
          ) : !hasValue ? (
            <button
              type="button"
              onClick={onOpenTextModal}
              className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Paste text from clipboard"
            >
              <FileText className="mr-1 inline size-3" />
              Paste Text
            </button>
          ) : null}
        </div>
      </div>

      {/* Hint text — only when empty and idle */}
      {!hasValue && status === 'idle' && (
        <p className="text-center text-xs text-muted-foreground/60">
          Tip: paste any URL to auto-scrape it
        </p>
      )}

      {/* URL confirmation card */}
      {isUrlMode && hasValue && !isDone && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Link className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">{value.trim()}</p>
          </div>
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={isLoading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Scraping...
              </>
            ) : (
              'Scrape & Save'
            )}
          </Button>
        </div>
      )}

      {/* Success state */}
      {isDone && result && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <CheckCircle2 className="size-4 shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{result.title}</p>
          </div>
          <Badge variant="secondary">Saved</Badge>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error.message}</p>
        </div>
      )}
    </div>
  );
}
