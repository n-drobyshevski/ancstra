'use client';

import { useCallback, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { List, PanelRight } from 'lucide-react';
import {
  usePersonResearchItems,
  usePersonFacts,
} from '@/lib/research/evidence-client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { SourceListPanel } from './source-list-panel';
import { FactMatrix } from './fact-matrix';
import { DetailPanel } from './detail-panel';

interface BoardTabProps {
  personId: string;
}

export function BoardTab({ personId }: BoardTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const selectedItemId = searchParams.get('item');

  const { items, refetch: refetchItems } = usePersonResearchItems(personId);
  const { facts, refetch: refetchFacts } = usePersonFacts(personId);

  const selectedItem = items.find((it) => it.id === selectedItemId) ?? null;

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const setSelectedItem = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('item', id);
      router.push(`${pathname}?${params.toString()}`);
      if (isMobile) setDetailOpen(true);
    },
    [searchParams, router, pathname, isMobile],
  );

  const handleDataChanged = useCallback(() => {
    refetchItems();
    refetchFacts();
  }, [refetchItems, refetchFacts]);

  if (isMobile) {
    return (
      <>
        {/* Mobile toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSourcesOpen(true)}
          >
            <List className="mr-1.5 size-3.5" />
            Sources
            {items.length > 0 && (
              <span className="ml-1 text-muted-foreground">({items.length})</span>
            )}
          </Button>
          {selectedItem && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailOpen(true)}
            >
              <PanelRight className="mr-1.5 size-3.5" />
              Detail
            </Button>
          )}
        </div>

        {/* Main content: FactMatrix full width */}
        <div className="h-[calc(100dvh-14rem)] rounded-lg border border-border overflow-hidden">
          <FactMatrix facts={facts} items={items} />
        </div>

        {/* Sources sheet (left) */}
        <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Sources</SheetTitle>
              <SheetDescription className="sr-only">
                Research items for this person
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto flex-1">
              <SourceListPanel
                items={items}
                facts={facts}
                selectedItemId={selectedItemId}
                onSelectItem={(id) => {
                  setSelectedItem(id);
                  setSourcesOpen(false);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Detail sheet (right) */}
        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Detail</SheetTitle>
              <SheetDescription className="sr-only">
                Selected research item details
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto flex-1">
              <DetailPanel
                item={selectedItem}
                facts={facts}
                personId={personId}
                onDataChanged={handleDataChanged}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: 3-column grid
  return (
    <div className="grid grid-cols-[280px_1fr_320px] h-[calc(100vh-16rem)] divide-x divide-border rounded-lg border border-border overflow-hidden">
      <SourceListPanel
        items={items}
        facts={facts}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItem}
      />
      <FactMatrix facts={facts} items={items} />
      <DetailPanel
        item={selectedItem}
        facts={facts}
        personId={personId}
        onDataChanged={handleDataChanged}
      />
    </div>
  );
}
