'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  useFactsheets,
  useFactsheetDetail,
} from '@/lib/research/factsheet-client';
import { usePersonResearchItems } from '@/lib/research/evidence-client';
import { FactsheetList } from './factsheet-list';
import { FactsheetDetail } from './factsheet-detail';

interface FactsheetsTabProps {
  personId: string;
}

export function FactsheetsTab({ personId }: FactsheetsTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedFactsheetId = searchParams.get('fs');

  const { factsheets, refetch: refetchList } = useFactsheets(personId);
  const { detail, refetch: refetchDetail } = useFactsheetDetail(selectedFactsheetId);
  const { items } = usePersonResearchItems(personId);

  const researchItemTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.id, item.title);
    }
    return map;
  }, [items]);

  const detailsMap = useMemo(() => {
    const map = new Map<string, { factCount: number; linkCount: number; conflictCount: number }>();
    if (detail) {
      map.set(detail.id, {
        factCount: detail.facts.length,
        linkCount: detail.links.length,
        conflictCount: 0,
      });
    }
    return map;
  }, [detail]);

  const setSelectedFactsheet = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('fs', id);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  useEffect(() => {
    if (!selectedFactsheetId && factsheets.length > 0) {
      setSelectedFactsheet(factsheets[0].id);
    }
  }, [selectedFactsheetId, factsheets, setSelectedFactsheet]);

  const handleDataChanged = useCallback(() => {
    refetchList();
    refetchDetail();
  }, [refetchList, refetchDetail]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] h-[calc(100vh-16rem)] divide-x divide-border rounded-lg border border-border overflow-hidden">
      <FactsheetList
        factsheets={factsheets}
        selectedId={selectedFactsheetId}
        details={detailsMap}
        onSelect={setSelectedFactsheet}
        onCreated={handleDataChanged}
      />
      {detail ? (
        <FactsheetDetail
          detail={detail}
          allFactsheets={factsheets}
          researchItemTitles={researchItemTitles}
          personId={personId}
          onDataChanged={handleDataChanged}
          onSelectFactsheet={setSelectedFactsheet}
        />
      ) : (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          {factsheets.length > 0
            ? 'Select a factsheet to view details'
            : 'Create your first factsheet to get started'}
        </div>
      )}
    </div>
  );
}
