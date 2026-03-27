'use client';

import { Suspense } from 'react';
import { Pencil, Search, Sparkles } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { PersonDetail } from '@ancstra/shared';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WorkspaceTabs, type WorkspaceView } from './workspace-tabs';
import { ResearchBreadcrumb } from '../breadcrumb';
import { usePersonConflicts } from '@/lib/research/evidence-client';
import { usePersonHints } from '@/lib/research/hints-client';
import { useFactsheets } from '@/lib/research/factsheet-client';
import { RecordTab } from '../record/record-tab';
import { BoardTab } from '../board/board-tab';
import { ConflictsTab } from '../conflicts/conflicts-tab';
import { TimelineTab } from '../timeline/timeline-tab';
import { HintsPanel } from '../hints/hints-panel';
import { MatrixTab } from '../matrix/matrix-tab';
import { CanvasTab } from '../canvas/canvas-tab';
import { ProofTab } from '../proof/proof-tab';
import { FactsheetsTab } from '../factsheets/factsheets-tab';
import { ResearchBiographyTab } from '../biography/biography-tab';
import { CitationsTab } from '../citations/citations-tab';

interface WorkspaceShellProps {
  person: PersonDetail;
  children?: React.ReactNode;
}

function getInitials(givenName: string, surname: string): string {
  const first = givenName.charAt(0).toUpperCase();
  const last = surname.charAt(0).toUpperCase();
  return `${first}${last}`.trim() || '?';
}

function formatDates(birthDate: string | null | undefined, deathDate: string | null | undefined): string {
  if (!birthDate && !deathDate) return '';
  const birth = birthDate ?? '?';
  const death = deathDate ?? '';
  return death ? `${birth} - ${death}` : `b. ${birth}`;
}

function ShellInner({ person, children }: WorkspaceShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = (searchParams.get('view') as WorkspaceView) || 'record';
  const { conflicts } = usePersonConflicts(person.id);
  const { hints } = usePersonHints(person.id, 'pending');
  const { factsheets } = useFactsheets(person.id);
  const activeFactsheetCount = factsheets.filter(f => f.status !== 'dismissed').length;
  const dates = formatDates(person.birthDate, person.deathDate);
  const personName = `${person.givenName} ${person.surname}`.trim();

  const goToRecord = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'record');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <ResearchBreadcrumb personName={personName} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{getInitials(person.givenName, person.surname)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">{personName}</h1>
            {dates && (
              <p className="text-sm text-muted-foreground">{dates}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeView !== 'record' && (
            <Button variant="outline" size="sm" onClick={goToRecord}>
              <Pencil className="mr-1.5" />
              Edit
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Search className="mr-1.5" />
            Search Sources
          </Button>
          <Button variant="outline" size="sm">
            <Sparkles className="mr-1.5" />
            Ask AI
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <WorkspaceTabs
        conflictCount={conflicts.length}
        hintCount={hints.length}
        factsheetCount={activeFactsheetCount}
      />

      {/* Tab content */}
      <div>
        {children ?? (
          <>
            {activeView === 'record' && <RecordTab person={person} />}
            {activeView === 'board' && <BoardTab personId={person.id} />}
            {activeView === 'matrix' && (
              <MatrixTab personId={person.id} personName={personName} />
            )}
            {activeView === 'conflicts' && <ConflictsTab personId={person.id} />}
            {activeView === 'timeline' && (
              <TimelineTab personId={person.id} events={person.events} />
            )}
            {activeView === 'canvas' && <CanvasTab personId={person.id} />}
            {activeView === 'hints' && (
              <HintsPanel
                personId={person.id}
                localPerson={{
                  givenName: person.givenName,
                  surname: person.surname,
                  birthDate: person.birthDate ?? null,
                  deathDate: person.deathDate ?? null,
                }}
              />
            )}
            {activeView === 'proof' && (
              <ProofTab personId={person.id} personName={personName} />
            )}
            {activeView === 'factsheets' && <FactsheetsTab personId={person.id} />}
            {activeView === 'biography' && (
              <ResearchBiographyTab personId={person.id} personName={personName} />
            )}
            {activeView === 'citations' && <CitationsTab personId={person.id} />}
          </>
        )}
      </div>
    </div>
  );
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <Suspense>
      <ShellInner {...props} />
    </Suspense>
  );
}
