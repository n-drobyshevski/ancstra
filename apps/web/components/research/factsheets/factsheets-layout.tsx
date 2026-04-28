'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useAllFactsheets,
  useFactsheetDetail,
  useAllFactsheetLinks,
  type Factsheet,
  type FactsheetDetail as FactsheetDetailType,
  type FactsheetLink,
} from '@/lib/research/factsheet-client';
import type { FactsheetWithCounts } from '@/lib/research/factsheet-client';
import { FactsheetSidebar } from './factsheet-sidebar';
import { FactsheetDetail } from './factsheet-detail';
import { FamilyPromoteModal } from './family-promote-modal';
import { NewFactsheetForm } from './new-factsheet-form';

const FactsheetGraphView = dynamic(
  () => import('./factsheet-graph-view').then((m) => ({ default: m.FactsheetGraphView })),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading graph...</div> }
);

interface FactsheetsLayoutProps {
  initialFactsheets?: FactsheetWithCounts[];
  initialLinks?: FactsheetLink[];
  initialDetail?: FactsheetDetailType | null;
}

export function FactsheetsLayout({
  initialFactsheets,
  initialLinks,
  initialDetail,
}: FactsheetsLayoutProps = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const view = searchParams.get('view') ?? 'detail';
  const selectedId = searchParams.get('fs');

  const [promoteCluster, setPromoteCluster] = useState<FactsheetWithCounts[] | null>(null);

  const { factsheets, refetch: refetchList } = useAllFactsheets(initialFactsheets);
  const { detail, refetch: refetchDetail } = useFactsheetDetail(selectedId, initialDetail);
  const { links, refetch: refetchLinks } = useAllFactsheetLinks(initialLinks);

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

  // Auto-select first factsheet (desktop only). Skipped during create mode
  // so the user isn't yanked into a detail view while focused on the form.
  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop && view !== 'create' && !selectedId && factsheets.length > 0) {
      setSelectedFactsheet(factsheets[0].id);
    }
  }, [selectedId, factsheets, setSelectedFactsheet, view]);

  const handleDataChanged = useCallback(() => {
    refetchList();
    refetchDetail();
    refetchLinks();
    // Server caches were invalidated by mutation routes via revalidateTag().
    // router.refresh() rerenders server components so the next paint uses
    // the freshly-revalidated cache entries.
    router.refresh();
  }, [refetchList, refetchDetail, refetchLinks, router]);

  // Create-mode handlers
  const handleCreate = useCallback(() => {
    setView('create');
  }, [setView]);

  const handleCancelCreate = useCallback(() => {
    // Drop create; selectedId stays so the user lands back where they were.
    setView('detail');
  }, [setView]);

  const handleSavedDraft = useCallback(
    (created: Factsheet) => {
      // Single push: select the new factsheet AND switch to detail view.
      const params = new URLSearchParams(searchParams.toString());
      params.set('fs', created.id);
      params.set('view', 'detail');
      router.push(`${pathname}?${params.toString()}`);
      refetchList();
    },
    [searchParams, router, pathname, refetchList]
  );

  const handleSavedResearch = useCallback(
    (title: string) => {
      router.push(`/research?q=${encodeURIComponent(title)}`);
    },
    [router]
  );

  const isCreate = view === 'create';
  // Hide page header on mobile when something else owns the screen
  // (factsheet detail OR create form, both with their own back-arrow header).
  const isMobileChromeOwned = !!(selectedId && detail) || isCreate;

  return (
    <>
      <div className="flex h-full flex-col gap-3">
        {/* Page header — hidden on mobile when a factsheet detail or the
            create form is open (those views supply their own back-arrow header). */}
        <div
          className={`${
            isMobileChromeOwned ? 'hidden md:flex' : 'flex'
          } items-center justify-between`}
        >
          <h1 className="text-lg font-semibold md:text-xl">Factsheets</h1>
          {!isCreate && (
            <Button onClick={handleCreate}>
              <Plus className="size-4" />
              <span>New Factsheet</span>
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden rounded-lg border border-border">
          {/* Desktop: 2-column grid */}
          <div className="hidden h-full md:grid md:grid-cols-[280px_1fr]">
            <FactsheetSidebar
              factsheets={factsheets}
              selectedId={selectedId}
              onSelect={setSelectedFactsheet}
              onDataChanged={handleDataChanged}
              onCreate={handleCreate}
            />

            <div className="flex flex-col overflow-hidden">
              {/* Toolbar — view toggle OR creating banner */}
              <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
                <div className="flex items-center gap-3">
                  {isCreate ? (
                    <>
                      <span className="text-sm font-medium">
                        Creating new factsheet
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={handleCancelCreate}
                        aria-label="Cancel creating new factsheet"
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Desktop content */}
              <div
                className={`flex-1 ${
                  view === 'graph' ? 'overflow-hidden' : 'overflow-y-auto'
                }`}
              >
                {isCreate ? (
                  <NewFactsheetForm
                    onCancel={handleCancelCreate}
                    onSavedDraft={handleSavedDraft}
                    onSavedResearch={handleSavedResearch}
                  />
                ) : view === 'detail' && detail ? (
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
                    onLinksChanged={handleDataChanged}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mobile: list, detail, OR create */}
          <div className="flex h-full flex-col md:hidden">
            {isCreate ? (
              <>
                {/* Mobile create header */}
                <div className="flex h-12 items-center gap-2 border-b border-border px-3">
                  <button
                    onClick={handleCancelCreate}
                    className="-ml-1 rounded-md p-1.5 hover:bg-muted"
                    aria-label="Cancel creating new factsheet"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <span className="flex-1 truncate text-sm font-semibold">
                    New Factsheet
                  </span>
                </div>
                {/* Mobile create content */}
                <div className="flex-1 overflow-y-auto pb-32">
                  <NewFactsheetForm
                    onCancel={handleCancelCreate}
                    onSavedDraft={handleSavedDraft}
                    onSavedResearch={handleSavedResearch}
                  />
                </div>
              </>
            ) : selectedId && detail ? (
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
                onCreate={handleCreate}
              />
            )}
          </div>
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
