'use client';

import { Suspense, useEffect, useCallback } from 'react';
import { Pencil, Search, Sparkles, MoreVertical } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { PersonDetail } from '@ancstra/shared';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarBadge } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkspaceTabs, type WorkspaceView } from './workspace-tabs';
import { ResearchBreadcrumb } from '../breadcrumb';
import { useBadgeCounts } from '@/lib/research/badge-counts-client';
import { setLastWorkspace } from '@/lib/research/activity';
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
  return death ? `${birth} – ${death}` : `b. ${birth}`;
}

const TAB_ORDER: WorkspaceView[] = [
  'record', 'timeline', 'conflicts', 'board', 'matrix', 'factsheets', 'hints', 'canvas', 'proof', 'biography',
];

function ShellInner({ person, children }: WorkspaceShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = (searchParams.get('view') as WorkspaceView) || 'record';
  const { conflictCount, hintCount, factsheetCount } = useBadgeCounts(person.id);
  const dates = formatDates(person.birthDate, person.deathDate);
  const birthPlace = person.birthPlace;
  const deathPlace = person.deathPlace;
  const personName = `${person.givenName} ${person.surname}`.trim();

  const setView = useCallback((view: WorkspaceView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === 'record') params.delete('view');
    else params.set('view', view);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, router, pathname]);

  // Track last workspace for "Continue where you left off"
  useEffect(() => {
    setLastWorkspace({ personId: person.id, personName, view: activeView });
  }, [person.id, personName, activeView]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= TAB_ORDER.length) {
        e.preventDefault();
        setView(TAB_ORDER[num - 1]);
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setView('record');
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setView]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Gradient banner + header */}
      <div className="relative -mx-4 -mt-4 px-4 pt-4 pb-5 md:-mx-6 md:px-6 bg-gradient-to-b from-primary/[0.04] to-transparent">
        <div className="space-y-3">
          <ResearchBreadcrumb personName={personName} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="text-base">
                  {getInitials(person.givenName, person.surname)}
                </AvatarFallback>
                {person.sex !== 'U' && (
                  <AvatarBadge className="size-4 text-[9px] font-bold">
                    {person.sex === 'M' ? '♂' : '♀'}
                  </AvatarBadge>
                )}
              </Avatar>
              <div>
                <h1 className="text-xl md:text-2xl font-semibold leading-tight tracking-tight">{personName}</h1>
                {dates && (
                  <p className="text-sm text-muted-foreground leading-snug">{dates}</p>
                )}
                {(birthPlace || deathPlace) && (
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                    {birthPlace && deathPlace
                      ? `${birthPlace} – ${deathPlace}`
                      : birthPlace ?? deathPlace}
                  </p>
                )}
              </div>
            </div>

            {/* Desktop: inline action buttons — ghost, outline, primary (left to right) */}
            <div className="hidden md:flex items-center gap-2">
              {activeView !== 'record' && (
                <Button variant="ghost" size="sm" onClick={() => setView('record')}>
                  <Pencil className="mr-1.5" />
                  Edit
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Search className="mr-1.5" />
                Search Sources
              </Button>
              <Button variant="default" size="sm">
                <Sparkles className="mr-1.5" />
                Ask AI
              </Button>
            </div>

            {/* Mobile: overflow menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="size-8">
                    <MoreVertical className="size-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {activeView !== 'record' && (
                    <DropdownMenuItem onClick={() => setView('record')}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <Search className="mr-2 size-4" />
                    Search Sources
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Sparkles className="mr-2 size-4" />
                    Ask AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <WorkspaceTabs
        conflictCount={conflictCount}
        hintCount={hintCount}
        factsheetCount={factsheetCount}
      />

      {/* Tab content — keyed for enter animation */}
      <div key={activeView} className="animate-tab-enter scroll-mt-24" data-view={activeView}>
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
