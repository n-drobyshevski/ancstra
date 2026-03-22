'use client';

import { useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProviderBadge } from './provider-badge';
import { toast } from 'sonner';
import type { SearchResult } from '@ancstra/research';

interface SearchResultCardProps {
  result: SearchResult;
  onSaved?: () => void;
}

export function SearchResultCard({ result, onSaved }: SearchResultCardProps) {
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
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <ProviderBadge providerId={result.providerId} />
            <h3 className="text-sm font-medium leading-snug">{result.title}</h3>
          </div>
          {result.relevanceScore != null && (
            <div className="shrink-0 text-right">
              <span className="text-xs text-muted-foreground">
                {Math.round(result.relevanceScore * 100)}%
              </span>
              <div className="mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${result.relevanceScore * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{snippet}</p>
        {result.extractedData && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {result.extractedData.name && (
              <span>
                <span className="font-medium text-foreground">Name:</span>{' '}
                {result.extractedData.name}
              </span>
            )}
            {result.extractedData.birthDate && (
              <span>
                <span className="font-medium text-foreground">Born:</span>{' '}
                {result.extractedData.birthDate}
              </span>
            )}
            {result.extractedData.deathDate && (
              <span>
                <span className="font-medium text-foreground">Died:</span>{' '}
                {result.extractedData.deathDate}
              </span>
            )}
            {result.extractedData.location && (
              <span>
                <span className="font-medium text-foreground">Location:</span>{' '}
                {result.extractedData.location}
              </span>
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
      </CardFooter>
    </Card>
  );
}
