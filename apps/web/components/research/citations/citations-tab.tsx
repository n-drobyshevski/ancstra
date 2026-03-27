'use client';

import { CitationList } from '@/components/citation-list';

interface CitationsTabProps {
  personId: string;
}

export function CitationsTab({ personId }: CitationsTabProps) {
  return (
    <div className="max-w-2xl">
      <CitationList personId={personId} />
    </div>
  );
}
