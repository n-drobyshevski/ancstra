'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { WorkspaceView } from './workspace/workspace-tabs';

const VIEW_LABELS: Record<WorkspaceView, string> = {
  record: 'Record',
  board: 'Board',
  matrix: 'Matrix',
  conflicts: 'Conflicts',
  timeline: 'Timeline',
  canvas: 'Canvas',
  hints: 'Hints',
  proof: 'Proof',
  factsheets: 'Factsheets',
  biography: 'Biography',
  citations: 'Citations',
};

interface ResearchBreadcrumbProps {
  personName: string;
}

function BreadcrumbInner({ personName }: ResearchBreadcrumbProps) {
  const searchParams = useSearchParams();
  const view = (searchParams.get('view') as WorkspaceView) || 'record';
  const viewLabel = VIEW_LABELS[view] ?? 'Record';

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-xs">
        <li>
          <Link
            href="/research"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            Research
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-3 text-muted-foreground" />
        </li>
        <li>
          <span className="max-w-[120px] truncate text-muted-foreground sm:max-w-none">
            {personName}
          </span>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-3 text-muted-foreground" />
        </li>
        <li aria-current="page">
          <span className="font-medium text-foreground">{viewLabel}</span>
        </li>
      </ol>
    </nav>
  );
}

export function ResearchBreadcrumb(props: ResearchBreadcrumbProps) {
  return (
    <Suspense>
      <BreadcrumbInner {...props} />
    </Suspense>
  );
}
