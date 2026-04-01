'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Upload, Download } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GedcomImport } from '@/components/gedcom-import';
import { ExportOptions } from '@/components/export/export-options';

function DataTransferTabsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') === 'export' ? 'export' : 'import';

  function handleTabChange(value: string) {
    const params = value === 'export' ? '?tab=export' : '';
    router.replace(`/data${params}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList variant="line">
        <TabsTrigger value="import">
          <Upload className="h-4 w-4" />
          Import
        </TabsTrigger>
        <TabsTrigger value="export">
          <Download className="h-4 w-4" />
          Export
        </TabsTrigger>
      </TabsList>
      <TabsContent value="import" className="pt-6">
        <GedcomImport />
      </TabsContent>
      <TabsContent value="export" className="pt-6">
        <ExportOptions />
      </TabsContent>
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
