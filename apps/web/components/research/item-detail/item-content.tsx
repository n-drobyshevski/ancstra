'use client';

import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemNotesEditor } from './item-notes-editor';
import { useScrapeUrl } from '@/lib/research/scrape-client';

interface ItemContentProps {
  item: {
    id: string;
    snippet: string | null;
    fullText: string | null;
    notes: string | null;
    url: string | null;
  };
  onNotesChange: (notes: string) => void;
}

export function ItemContent({ item, onNotesChange }: ItemContentProps) {
  const [expanded, setExpanded] = useState(false);
  const { scrape, isLoading: scraping } = useScrapeUrl();
  const [scraped, setScraped] = useState(false);

  const handleScrape = useCallback(async () => {
    if (!item.url) return;
    const result = await scrape(item.url);
    if (result) {
      setScraped(true);
      window.location.reload();
    }
  }, [item.url, scrape]);

  const fullTextPreview = item.fullText
    ? item.fullText.length > 200
      ? item.fullText.slice(0, 200) + '...'
      : item.fullText
    : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h3>
        {item.snippet ? (
          <p className="text-sm leading-relaxed text-foreground">{item.snippet}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No summary available.</p>
        )}
      </div>

      {/* Full Text */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Text</h3>
        {item.fullText ? (
          <>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {expanded ? item.fullText : fullTextPreview}
            </p>
            {item.fullText.length > 200 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-sm text-primary hover:underline"
                aria-expanded={expanded}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">No full text available.</p>
            {item.url && !scraped && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleScrape}
                disabled={scraping}
              >
                {scraping ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  'Scrape URL'
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border/80 p-4">
        <ItemNotesEditor
          itemId={item.id}
          initialNotes={item.notes}
          onNotesChange={onNotesChange}
        />
      </div>
    </div>
  );
}
