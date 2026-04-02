'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Bookmark, BookmarkCheck, Sparkles, Eye, Copy, ClipboardCopy } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ProviderBadge, getProviderConfig } from './provider-badge';
import { toast } from 'sonner';
import type { SearchResult } from '@ancstra/research';

function buildPreviewUrl(result: SearchResult): string {
  const params = new URLSearchParams();
  params.set('title', result.title);
  if (result.url) params.set('url', result.url);
  if (result.snippet) params.set('snippet', result.snippet);
  if (result.providerId) params.set('providerId', result.providerId);
  if (result.externalId) params.set('externalId', result.externalId);
  if (result.relevanceScore != null) params.set('relevanceScore', String(result.relevanceScore));
  if (result.extractedData?.name) params.set('extractedName', result.extractedData.name);
  if (result.extractedData?.birthDate) params.set('extractedBirthDate', result.extractedData.birthDate);
  if (result.extractedData?.deathDate) params.set('extractedDeathDate', result.extractedData.deathDate);
  if (result.extractedData?.location) params.set('extractedLocation', result.extractedData.location);
  return `/research/item/preview?${params.toString()}`;
}

interface SearchResultCardProps {
  result: SearchResult;
  onBookmark?: () => void;
  onAskAi?: (prompt: string) => void;
  isBookmarked?: boolean;
}

export function SearchResultCard({ result, onBookmark, onAskAi, isBookmarked }: SearchResultCardProps) {
  const [bookmarking, setBookmarking] = useState(false);
  const [justBookmarked, setJustBookmarked] = useState(false);
  const [snippetExpanded, setSnippetExpanded] = useState(false);
  const saved = isBookmarked || justBookmarked;
  const router = useRouter();

  async function handleBookmark() {
    setBookmarking(true);
    try {
      const res = await fetch('/api/research/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          providerId: result.providerId,
          providerRecordId: result.externalId,
          discoveryMethod: 'search',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }

      setJustBookmarked(true);
      toast.success('Bookmarked');
      onBookmark?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBookmarking(false);
    }
  }

  const isLongSnippet = result.snippet.length > 200;
  const displaySnippet = isLongSnippet && !snippetExpanded
    ? result.snippet.slice(0, 200) + '...'
    : result.snippet;

  const previewUrl = buildPreviewUrl(result);
  const providerConfig = getProviderConfig(result.providerId);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link href={previewUrl} className="block">
          <Card size="sm" className={`border-l-3 ${providerConfig.borderClass} transition-shadow hover:shadow-sm`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <ProviderBadge providerId={result.providerId} />
                  <h3 className="text-sm font-medium leading-snug">{result.title}</h3>
                </div>
                {result.relevanceScore != null && (
                  <RelevanceBadge score={result.relevanceScore} />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground transition-all duration-150">
                {displaySnippet}
                {isLongSnippet && (
                  <>
                    {' '}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSnippetExpanded(!snippetExpanded); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setSnippetExpanded(!snippetExpanded); } }}
                      className="text-xs text-primary cursor-pointer hover:underline"
                    >
                      {snippetExpanded ? 'Show less' : 'Show more'}
                    </span>
                  </>
                )}
              </p>
              {result.extractedData && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.extractedData.name && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {result.extractedData.name}
                    </Badge>
                  )}
                  {result.extractedData.birthDate && (
                    <Badge variant="outline" className="text-xs font-normal">
                      b. {result.extractedData.birthDate}
                    </Badge>
                  )}
                  {result.extractedData.deathDate && (
                    <Badge variant="outline" className="text-xs font-normal">
                      d. {result.extractedData.deathDate}
                    </Badge>
                  )}
                  {result.extractedData.location && (
                    <Badge variant="outline" className="text-xs font-normal">
                      {result.extractedData.location}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              {saved ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <BookmarkCheck className="size-3.5" />
                      Saved
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Already in your bookmarks</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleBookmark(); }} disabled={bookmarking}>
                      <Bookmark className="size-3.5" />
                      {bookmarking ? 'Bookmarking...' : 'Bookmark'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save to bookmarks</TooltipContent>
                </Tooltip>
              )}
              {result.url && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(result.url, '_blank', 'noopener,noreferrer'); }}>
                      <ExternalLink className="size-3.5" />
                      View
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open original source</TooltipContent>
                </Tooltip>
              )}
              {onAskAi && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onAskAi(
                          `Tell me more about this record: "${result.title}" from ${providerConfig.label}. URL: ${result.url}. Snippet: ${result.snippet}`
                        );
                      }}
                    >
                      <Sparkles className="size-3.5" />
                      Ask AI
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ask AI about this record</TooltipContent>
                </Tooltip>
              )}
            </CardFooter>
          </Card>
        </Link>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem
          onSelect={() => router.push(previewUrl)}
        >
          <Eye className="size-4" />
          Open Preview
        </ContextMenuItem>

        <ContextMenuItem
          onSelect={handleBookmark}
          disabled={saved || bookmarking}
        >
          {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          {saved ? 'Already bookmarked' : bookmarking ? 'Bookmarking...' : 'Bookmark'}
        </ContextMenuItem>

        {result.url && (
          <ContextMenuItem
            onSelect={() => window.open(result.url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="size-4" />
            Open Source
          </ContextMenuItem>
        )}

        {onAskAi && (
          <ContextMenuItem
            onSelect={() =>
              onAskAi(
                `Tell me more about this record: "${result.title}" from ${providerConfig.label}. URL: ${result.url}. Snippet: ${result.snippet}`
              )
            }
          >
            <Sparkles className="size-4" />
            Ask AI
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          onSelect={() => {
            navigator.clipboard.writeText(result.title);
            toast.success('Title copied');
          }}
        >
          <Copy className="size-4" />
          Copy Title
        </ContextMenuItem>

        {result.url && (
          <ContextMenuItem
            onSelect={() => {
              navigator.clipboard.writeText(result.url!);
              toast.success('URL copied');
            }}
          >
            <ClipboardCopy className="size-4" />
            Copy URL
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/* ── Relevance tier badge ── */

function RelevanceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let label: string;
  let className: string;

  if (score >= 0.75) {
    label = 'High';
    className = 'bg-status-success-bg text-status-success-text';
  } else if (score >= 0.5) {
    label = 'Med';
    className = 'bg-status-warning-bg text-status-warning-text';
  } else {
    label = 'Low';
    className = 'bg-muted text-muted-foreground';
  }

  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${className}`}>
      {label} {pct}%
    </span>
  );
}
