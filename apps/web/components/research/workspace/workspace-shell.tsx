'use client';

import { Suspense } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { WorkspaceTabs, type WorkspaceView } from './workspace-tabs';
import { ResearchBreadcrumb } from '../breadcrumb';
import { useSearchParams } from 'next/navigation';
import { usePersonConflicts } from '@/lib/research/evidence-client';
import { usePersonHints } from '@/lib/research/hints-client';
import { BoardTab } from '../board/board-tab';
import { ConflictsTab } from '../conflicts/conflicts-tab';
import { TimelineTab } from '../timeline/timeline-tab';
import { HintsPanel } from '../hints/hints-panel';
import { MatrixTab } from '../matrix/matrix-tab';
import { CanvasTab } from '../canvas/canvas-tab';
import { ProofTab } from '../proof/proof-tab';

interface PersonSummary {
  id: string;
  givenName: string;
  surname: string;
  birthDate: string | null;
  deathDate: string | null;
  sex: string;
}

interface WorkspaceShellProps {
  person: PersonSummary;
  children?: React.ReactNode;
}

function getInitials(givenName: string, surname: string): string {
  const first = givenName.charAt(0).toUpperCase();
  const last = surname.charAt(0).toUpperCase();
  return `${first}${last}`.trim() || '?';
}

function formatDates(birthDate: string | null, deathDate: string | null): string {
  if (!birthDate && !deathDate) return '';
  const birth = birthDate ?? '?';
  const death = deathDate ?? '';
  return death ? `${birth} - ${death}` : `b. ${birth}`;
}

function ShellInner({ person, children }: WorkspaceShellProps) {
  const searchParams = useSearchParams();
  const activeView = (searchParams.get('view') as WorkspaceView) || 'board';
  const { conflicts } = usePersonConflicts(person.id);
  const { hints } = usePersonHints(person.id, 'pending');
  const dates = formatDates(person.birthDate, person.deathDate);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <ResearchBreadcrumb personName={`${person.givenName} ${person.surname}`.trim()} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>{getInitials(person.givenName, person.surname)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-semibold">
              {person.givenName} {person.surname}
            </h1>
            {dates && (
              <p className="text-sm text-muted-foreground">{dates}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      <WorkspaceTabs conflictCount={conflicts.length} hintCount={hints.length} />

      {/* Tab content */}
      <div>
        {children ?? (
          <>
            {activeView === 'board' && <BoardTab personId={person.id} />}
            {activeView === 'matrix' && (
              <MatrixTab
                personId={person.id}
                personName={`${person.givenName} ${person.surname}`.trim()}
              />
            )}
            {activeView === 'conflicts' && (
              <ConflictsTab personId={person.id} />
            )}
            {activeView === 'timeline' && (
              <TimelineTab personId={person.id} />
            )}
            {activeView === 'canvas' && (
              <CanvasTab personId={person.id} />
            )}
            {activeView === 'hints' && (
              <HintsPanel
                personId={person.id}
                localPerson={{
                  givenName: person.givenName,
                  surname: person.surname,
                  birthDate: person.birthDate,
                  deathDate: person.deathDate,
                }}
              />
            )}
            {activeView === 'proof' && (
              <ProofTab
                personId={person.id}
                personName={`${person.givenName} ${person.surname}`.trim()}
              />
            )}
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
