'use client';

import { useState, useCallback } from 'react';
import { Link, Loader2, CheckCircle2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScrapeUrl } from '@/lib/research/scrape-client';

const URL_REGEX = /^https?:\/\//;

interface UrlPasteInputProps {
  onSaved?: () => void;
}

export function UrlPasteInput({ onSaved }: UrlPasteInputProps) {
  const [value, setValue] = useState('');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const { scrape, status, result, error, isLoading } = useScrapeUrl();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);

    // Auto-detect URL paste
    if (URL_REGEX.test(v.trim()) && !pendingUrl) {
      setPendingUrl(v.trim());
    } else if (!URL_REGEX.test(v.trim())) {
      setPendingUrl(null);
    }
  }, [pendingUrl]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (URL_REGEX.test(pasted)) {
      setPendingUrl(pasted);
    }
  }, []);

  const handleScrape = useCallback(async () => {
    if (!pendingUrl) return;
    const res = await scrape(pendingUrl);
    if (res) {
      onSaved?.();
    }
  }, [pendingUrl, scrape, onSaved]);

  const handleClear = useCallback(() => {
    setValue('');
    setPendingUrl(null);
  }, []);

  const isDone = status === 'done';

  return (
    <div className="space-y-2">
      <div className="relative">
        <Link className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder="Paste a URL to archive..."
          className="pl-9 pr-9"
          disabled={isLoading}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Confirmation card */}
      {pendingUrl && !isDone && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate text-muted-foreground">{pendingUrl}</p>
          </div>
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={isLoading}
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
            <p className="text-sm font-medium truncate">{result.title}</p>
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
