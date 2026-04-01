import { DataTransferTabs } from '@/components/data-transfer-tabs';
import { PagePadding } from '@/components/page-padding';

export default function DataPage() {
  return (
    <PagePadding>
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-xl font-semibold mb-6">Import & Export</h1>
        <DataTransferTabs />
      </div>
    </PagePadding>
  );
}
