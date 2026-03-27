'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft } from 'lucide-react';
import { useAllFactsheets, useFactsheetDetail, useAllFactsheetLinks } from '@/lib/research/factsheet-client';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';
import { FactsheetSidebar } from './factsheet-sidebar';
import { FactsheetDetail } from './factsheet-detail';
import { FamilyPromoteModal } from './family-promote-modal';

const FactsheetGraphView = dynamic(
  () => import('./factsheet-graph-view').then((m) => ({ default: m.FactsheetGraphView })),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading graph...</div> }
);

export function FactsheetsLayout() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = searchParams.get('view') ?? 'detail';
  const selectedId = searchParams.get('fs');

  const [promoteCluster, setPromoteCluster] = useState<FactsheetWithCounts[] | null>(null);

  const { factsheets, refetch: refetchList } = useAllFactsheets();
  const { detail, refetch: refetchDetail } = useFactsheetDetail(selectedId);
  const { links } = useAllFactsheetLinks();

  const researchItemTitles = useMemo(() => new Map<string, string>(), []);

  // Strip count fields to get base Factsheet[] for FactsheetDetail
  const allFactsheets = useMemo(
    () => factsheets.map(({ factCount, linkCount, conflictCount, isUnanchored, ...fs }) => fs),
    [factsheets]
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const setSelectedFactsheet = useCallback(
    (id: string) => setParam('fs', id),
    [setParam]
  );

  const setView = useCallback(
    (v: string) => setParam('view', v),
    [setParam]
  );

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('fs');
    params.delete('view');
    router.push(`${pathname}?${params.toString()}`);
  }, [searchParams, router, pathname]);

  // Auto-select first factsheet (desktop only)
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop && !selectedId && factsheets.length > 0) {
      setSelectedFactsheet(factsheets[0].id);
    }
  }, [selectedId, factsheets, setSelectedFactsheet]);

  const handleDataChanged = useCallback(() => {
    refetchList();
    refetchDetail();
  }, [refetchList, refetchDetail]);

  return (
    <>
      <div className="h-full overflow-hidden rounded-lg border border-border">
        {/* Desktop: 2-column grid */}
        <div className="hidden h-full md:grid md:grid-cols-[280px_1fr]">
          <FactsheetSidebar
            factsheets={factsheets}
            selectedId={selectedId}
            onSelect={setSelectedFactsheet}
            onDataChanged={handleDataChanged}
          />

          <div className="flex flex-col overflow-hidden">
            {/* Toolbar with view toggle */}
            <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
              <div className="flex items-center gap-3">
                <div className="flex overflow-hidden rounded-lg border border-border">
                  <button
                    onClick={() => setView('detail')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      view === 'detail'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Detail
                  </button>
                  <button
                    onClick={() => setView('graph')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      view === 'graph'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Graph
                  </button>
                </div>
                {view === 'detail' && detail && (
                  <span className="text-sm font-semibold">{detail.title}</span>
                )}
                {view === 'graph' && (
                  <span className="text-xs text-muted-foreground">
                    {factsheets.length} factsheets
                  </span>
                )}
              </div>
            </div>

            {/* Desktop content */}
            <div className={`flex-1 ${view === 'graph' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              {view === 'detail' && detail ? (
                <FactsheetDetail
                  detail={detail}
                  allFactsheets={allFactsheets}
                  researchItemTitles={researchItemTitles}
                  onDataChanged={handleDataChanged}
                  onSelectFactsheet={setSelectedFactsheet}
                />
              ) : view === 'detail' ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {factsheets.length > 0
                    ? 'Select a factsheet from the list'
                    : 'No factsheets yet. Create one to get started.'}
                </div>
              ) : (
                <FactsheetGraphView
                  factsheets={factsheets}
                  links={links}
                  selectedId={selectedId}
                  onSelectFactsheet={setSelectedFactsheet}
                  onPromoteCluster={(cluster) => setPromoteCluster(cluster)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Mobile: list OR detail */}
        <div className="flex h-full flex-col md:hidden">
          {selectedId && detail ? (
            <>
              {/* Mobile detail header */}
              <div className="flex h-12 items-center gap-2 border-b border-border px-3">
                <button
                  onClick={clearSelection}
                  className="-ml-1 rounded-md p-1.5 hover:bg-muted"
                  aria-label="Back to factsheet list"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <span className="flex-1 truncate text-sm font-semibold">{detail.title}</span>
              </div>
              {/* Mobile detail content */}
              <div className="flex-1 overflow-y-auto">
                <FactsheetDetail
                  detail={detail}
                  allFactsheets={allFactsheets}
                  researchItemTitles={researchItemTitles}
                  onDataChanged={handleDataChanged}
                  onSelectFactsheet={setSelectedFactsheet}
                />
              </div>
            </>
          ) : (
            <FactsheetSidebar
              factsheets={factsheets}
              selectedId={selectedId}
              onSelect={setSelectedFactsheet}
              onDataChanged={handleDataChanged}
            />
          )}
        </div>
      </div>

      {promoteCluster && (
        <FamilyPromoteModal
          open={!!promoteCluster}
          onClose={() => setPromoteCluster(null)}
          factsheets={promoteCluster}
          onPromoted={() => {
            setPromoteCluster(null);
            handleDataChanged();
          }}
        />
      )}
    </>
  );
}
