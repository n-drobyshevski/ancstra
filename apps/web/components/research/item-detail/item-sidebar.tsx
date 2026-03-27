'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProviderBadge } from '../provider-badge';
import { useResearchItemFacts } from '@/lib/research/evidence-client';
import {
  DISCOVERY_METHOD_LABELS,
  CONFIDENCE_VARIANT,
} from '@/lib/research/constants';

interface ItemSidebarProps {
  item: {
    id: string;
    providerId: string | null;
    discoveryMethod: string;
    searchQuery: string | null;
    archivedAt: string | null;
    url: string | null;
    createdAt: string;
    updatedAt: string;
    personIds: string[];
  };
}

function formatFactType(factType: string): string {
  return factType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ItemSidebar({ item }: ItemSidebarProps) {
  const { facts, isLoading: factsLoading } = useResearchItemFacts(item.id);

  const methodLabel = DISCOVERY_METHOD_LABELS[item.discoveryMethod] ?? item.discoveryMethod;

  return (
    <div className="space-y-4">
      {/* Extracted Facts */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Extracted Facts {facts.length > 0 && `(${facts.length})`}
        </h3>
        {factsLoading ? (
          <p className="text-sm text-muted-foreground">Loading facts...</p>
        ) : facts.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">No facts extracted yet.</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled
              title="Coming soon"
            >
              Extract Facts
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {facts.map((fact) => (
              <div key={fact.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{formatFactType(fact.factType)}</span>
                  <p className="font-medium">{fact.factValue}</p>
                </div>
                <Badge variant={CONFIDENCE_VARIANT[fact.confidence] ?? 'outline'} className="shrink-0 text-[10px]">
                  {fact.confidence}
                </Badge>
              </div>
            ))}
            <div className="border-t border-border pt-2 text-center">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                disabled
                title="Coming soon"
              >
                + Extract more facts
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Linked People */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Linked People {item.personIds.length > 0 && `(${item.personIds.length})`}
        </h3>
        {item.personIds.length === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">No people linked yet.</p>
            <Button size="sm" variant="ghost" className="mt-2 text-xs text-primary">
              + Link to person
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {item.personIds.map((personId) => (
              <Link
                key={personId}
                href={`/person/${personId}`}
                className="block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                {personId}
              </Link>
            ))}
            <div className="border-t border-border pt-2 text-center">
              <Button size="sm" variant="ghost" className="text-xs text-primary">
                + Link to person
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="rounded-lg border border-border/80 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </h3>
        <dl className="space-y-2 text-sm">
          {item.providerId && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Provider</dt>
              <dd><ProviderBadge providerId={item.providerId} /></dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Found via</dt>
            <dd>{methodLabel}</dd>
          </div>
          {item.searchQuery && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Search query</dt>
              <dd className="max-w-[160px] truncate text-muted-foreground">{item.searchQuery}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Archived</dt>
            <dd>{item.archivedAt ? `Yes (${new Date(item.archivedAt).toLocaleDateString()})` : 'No'}</dd>
          </div>
          {item.url && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">URL</dt>
              <dd>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline max-w-[160px] truncate"
                >
                  {(() => { try { return new URL(item.url).hostname; } catch { return item.url; } })()}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(item.createdAt).toLocaleDateString()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{new Date(item.updatedAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
