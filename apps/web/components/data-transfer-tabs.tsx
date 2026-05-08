'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Upload, Download } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GedcomImport } from '@/components/gedcom-import';
import { ExportOptions } from '@/components/export/export-options';
import { useHasPermission } from '@/lib/auth/use-has-permission';

function DataTransferTabsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const canImport = useHasPermission('gedcom:import');
  const canExport = useHasPermission('gedcom:export');

  // Resolve the requested tab against actual permissions. An editor (export-only)
  // landing on /data without a ?tab= param should see Export; hitting ?tab=import
  // silently snaps to Export so we never render a tab the user can't use.
  const requestedTab = searchParams.get('tab') === 'export' ? 'export' : 'import';
  const activeTab = canImport && canExport
    ? requestedTab
    : canImport
      ? 'import'
      : canExport
        ? 'export'
        : null;

  // Sync URL when our chosen tab differs from the requested one (e.g. editor
  // forced from import → export). Skip when no permitted tab exists — the page
  // guard will redirect on the next render anyway.
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab === requestedTab) return;
    const target = activeTab === 'export' ? '/data?tab=export' : '/data';
    router.replace(target, { scroll: false });
  }, [activeTab, requestedTab, router]);

  function handleTabChange(value: string) {
    const params = value === 'export' ? '?tab=export' : '';
    router.replace(`/data${params}`, { scroll: false });
  }

  if (!activeTab) return null;

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList variant="line">
        {canImport && (
          <TabsTrigger value="import">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
        )}
        {canExport && (
          <TabsTrigger value="export">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
        )}
      </TabsList>
      {canImport && (
        <TabsContent value="import" className="pt-6">
          <GedcomImport />
        </TabsContent>
      )}
      {canExport && (
        <TabsContent value="export" className="pt-6">
          <ExportOptions />
        </TabsContent>
      )}
    </Tabs>
  );
}

export function DataTransferTabs() {
  return (
    <Suspense>
      <DataTransferTabsInner />
    </Suspense>
  );
}
