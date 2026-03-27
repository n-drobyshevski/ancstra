'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAllFactsheets, useFactsheetDetail, useAllFactsheetLinks } from '@/lib/research/factsheet-client';
import { FactsheetSidebar } from './factsheet-sidebar';
import { FactsheetDetail } from './factsheet-detail';

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

  // Auto-select first factsheet
  useEffect(() => {
    if (!selectedId && factsheets.length > 0) {
      setSelectedFactsheet(factsheets[0].id);
    }
  }, [selectedId, factsheets, setSelectedFactsheet]);

  const handleDataChanged = useCallback(() => {
    refetchList();
    refetchDetail();
  }, [refetchList, refetchDetail]);

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden rounded-lg border border-border">
      <FactsheetSidebar
        factsheets={factsheets}
        selectedId={selectedId}
        onSelect={setSelectedFactsheet}
        onDataChanged={handleDataChanged}
      />

      <div className="flex flex-col overflow-hidden">
        {/* Toolbar */}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
