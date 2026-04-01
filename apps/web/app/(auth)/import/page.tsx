import { GedcomImport } from '@/components/gedcom-import';
import { PagePadding } from '@/components/page-padding';

export default function ImportPage() {
  return (
    <PagePadding>
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-6">Import GEDCOM File</h1>
      <GedcomImport />
    </div>
    </PagePadding>
  );
}
