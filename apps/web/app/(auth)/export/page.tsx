import { ExportOptions } from '@/components/export/export-options';

export default function ExportPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-6">Export GEDCOM</h1>
      <ExportOptions />
    </div>
  );
}
