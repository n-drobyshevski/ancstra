'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProviderBadge } from '../provider-badge';
import { ItemNotesEditor } from './item-notes-editor';
import { useResearchItemFacts } from '@/lib/research/evidence-client';
import {
  DISCOVERY_METHOD_LABELS,
  CONFIDENCE_VARIANT,
} from '@/lib/research/constants';

interface ItemDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    title: string;
    url: string | null;
    notes: string | null;
    providerId: string | null;
    discoveryMethod: string;
    searchQuery: string | null;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
    personIds: string[];
  };
  onNotesChange: (notes: string) => void;
}

function formatFactType(factType: string): string {
  return factType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DrawerInner({
  item,
  snap,
  onNotesChange,
}: {
  item: ItemDetailDrawerProps['item'];
  snap: number | string | null;
  onNotesChange: (notes: string) => void;
}) {
  const { facts, isLoading: factsLoading } = useResearchItemFacts(item.id);
  const isFullSnap = snap === 0.85;
  const methodLabel = DISCOVERY_METHOD_LABELS[item.discoveryMethod] ?? item.discoveryMethod;

  return (
    <>
      <DrawerTitle className="sr-only">Item Details</DrawerTitle>

      <Tabs defaultValue="facts" className="flex h-full flex-col">
        <TabsList className="mx-4 mt-2 shrink-0">
          <TabsTrigger value="facts" className="min-h-[40px]">Facts</TabsTrigger>
          <TabsTrigger value="people" className="min-h-[40px]">People</TabsTrigger>
          <TabsTrigger value="details" className="min-h-[40px]">Details</TabsTrigger>
          <TabsTrigger value="notes" className="min-h-[40px]">Notes</TabsTrigger>
        </TabsList>

        <div className={`flex-1 ${isFullSnap ? 'overflow-y-auto' : 'overflow-hidden'} pb-[env(safe-area-inset-bottom)]`}>
          {/* Facts */}
          <TabsContent value="facts" className="px-4 py-3">
            {factsLoading ? (
              <p className="text-sm text-muted-foreground">Loading facts...</p>
            ) : facts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No facts extracted yet.</p>
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
              </div>
            )}
          </TabsContent>

          {/* People */}
          <TabsContent value="people" className="px-4 py-3">
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
                    href={`/persons/${personId}`}
                    className="block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    {personId}
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Details */}
          <TabsContent value="details" className="px-4 py-3">
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
          </TabsContent>

          {/* Notes */}
          <TabsContent value="notes" className="px-4 py-3">
            <ItemNotesEditor
              itemId={item.id}
              initialNotes={item.notes}
              onNotesChange={onNotesChange}
            />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}

export function ItemDetailDrawer({
  open,
  onOpenChange,
  item,
  onNotesChange,
}: ItemDetailDrawerProps) {
  const [snap, setSnap] = useState<number | string | null>(0.4);

  // Reset snap when drawer opens
  useEffect(() => {
    if (open) {
      setSnap(0.4);
    }
  }, [open]);

  // Radix Dialog sets pointer-events:none on <body> when open.
  // For our non-modal drawer this blocks touch on the content underneath.
  useEffect(() => {
    if (!open) return;
    const restore = () => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.removeProperty('pointer-events');
      }
    };
    restore();
    const obs = new MutationObserver(restore);
    obs.observe(document.body, { attributeFilter: ['style'] });
    return () => obs.disconnect();
  }, [open]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={[0.4, 0.85]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      fadeFromIndex={1}
      modal={false}
      shouldScaleBackground={false}
    >
      <DrawerContent overlay={false} className="data-[vaul-drawer-direction=bottom]:h-dvh data-[vaul-drawer-direction=bottom]:max-h-dvh">
        <DrawerInner item={item} snap={snap} onNotesChange={onNotesChange} />
      </DrawerContent>
    </Drawer>
  );
}
