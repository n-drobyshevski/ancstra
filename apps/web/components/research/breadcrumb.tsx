'use client';

import { Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import {
  ChevronRight,
  UserPen, LayoutGrid, Table2, GitCompareArrows, Clock,
  PenTool, BookOpen, FileText, Layers, BookMarked, Quote,
  type LucideIcon,
} from 'lucide-react';
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

const VIEW_ICONS: Record<WorkspaceView, LucideIcon> = {
  record: UserPen, board: LayoutGrid, matrix: Table2,
  conflicts: GitCompareArrows, timeline: Clock, canvas: PenTool,
  hints: BookOpen, proof: FileText, factsheets: Layers,
  biography: BookMarked, citations: Quote,
};

interface ResearchBreadcrumbProps {
  personName: string;
}

function BreadcrumbInner({ personName }: ResearchBreadcrumbProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const view = (searchParams.get('view') as WorkspaceView) || 'record';
  const viewLabel = VIEW_LABELS[view] ?? 'Record';

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm md:text-xs">
        <li>
          <Link
            href="/persons"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            People
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-3 text-muted-foreground" />
        </li>
        <li>
          <Link
            href={pathname}
            className="max-w-[120px] truncate text-muted-foreground transition-colors hover:text-primary sm:max-w-none"
          >
            {personName}
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="size-3 text-muted-foreground" />
        </li>
        <li aria-current="page" className="inline-flex items-center gap-1">
          {(() => { const Icon = VIEW_ICONS[view]; return Icon ? <Icon className="size-3 text-primary/70" /> : null; })()}
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
