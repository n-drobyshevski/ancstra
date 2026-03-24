'use client';

import { useState } from 'react';
import { ExternalLink, Plus, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProviderBadge, getProviderConfig } from './provider-badge';
import { toast } from 'sonner';
import type { SearchResult } from '@ancstra/research';

interface SearchResultCardProps {
  result: SearchResult;
  onSaved?: () => void;
  onAskAi?: (prompt: string) => void;
}

export function SearchResultCard({ result, onSaved, onAskAi }: SearchResultCardProps) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
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

      toast.success('Saved to research items');
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const snippet =
    result.snippet.length > 200
      ? result.snippet.slice(0, 200) + '...'
      : result.snippet;

  return (
    <Card size="sm" className={`border-l-3 ${getProviderConfig(result.providerId).borderClass} transition-shadow hover:shadow-sm`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <ProviderBadge providerId={result.providerId} />
            <h3 className="text-sm font-medium leading-snug">{result.title}</h3>
          </div>
          {result.relevanceScore != null && (
            <div className="shrink-0 flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${result.relevanceScore * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {Math.round(result.relevanceScore * 100)}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{snippet}</p>
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
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
          <Plus className="size-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {result.url && (
          <Button size="sm" variant="ghost" asChild>
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              View
            </a>
          </Button>
        )}
        {onAskAi && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onAskAi(
                `Tell me more about this record: "${result.title}" from ${getProviderConfig(result.providerId).label}. URL: ${result.url}. Snippet: ${result.snippet}`
              )
            }
          >
            <Sparkles className="size-3.5" />
            Ask AI
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
