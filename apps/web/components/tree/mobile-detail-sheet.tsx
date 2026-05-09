'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Network, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PersonListItem, TreeData } from '@ancstra/shared';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  usePersonDetail,
  DetailHeaderCompact,
  DetailVitalInfoReadOnly,
  DetailFamily,
  DetailTimeline,
  DetailNotesReadOnly,
  DetailSources,
} from './detail-sections';
import { Skeleton } from '@/components/ui/skeleton';
import { PersonCreateDialog } from '@/components/person-create-dialog';
import { PersonLinkDialog, type RelationType } from '@/components/person-link-dialog';
import { personDetailCache } from '@/lib/tree/person-detail-cache';

const ADD_RELATION_KEYS: RelationType[] = ['spouse', 'father', 'mother', 'child', 'sibling'];

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

interface MobileDetailSheetProps {
  person: PersonListItem | null;
  treeData: TreeData;
  onClose: () => void;
  onFocusNode: (personId: string) => void;
  onSeeOnTree: (personId: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Inner content — rendered only when a person is selected                   */
/* -------------------------------------------------------------------------- */

function SheetContent({
  person,
  treeData,
  snap,
  onFocusNode,
  onSeeOnTree,
}: {
  person: PersonListItem;
  treeData: TreeData;
  snap: number | string | null;
  onFocusNode: (personId: string) => void;
  onSeeOnTree: (personId: string) => void;
}) {
  const router = useRouter();
  const tMobile = useTranslations('tree.mobile');
  const tAdd = useTranslations('tree.mobile.addRelation');
  const tRelations = useTranslations('tree.mobile.addRelation.relations');
  const tSex = useTranslations('tree.mobile.sex');
  const { person: fullPerson, events, citationCount, isLoading } = usePersonDetail(person.id);
  const isFullSnap = snap === 0.85;
  const [dialog, setDialog] = useState<{
    kind: 'create' | 'link';
    relation: RelationType;
  } | null>(null);

  const personSex = (fullPerson?.sex ?? person.sex) as 'M' | 'F' | 'U';
  const fullName = `${person.givenName} ${person.surname}`;

  const handleAfterMutation = useCallback(() => {
    personDetailCache.invalidate(person.id);
    router.refresh();
    setDialog(null);
  }, [person.id, router]);

  return (
    <>
      {/* Accessibility title */}
      <DrawerTitle className="sr-only">
        {person.givenName} {person.surname}
      </DrawerTitle>

      {/* Peek header — always visible */}
      <div className="px-4 pt-2 pb-3 border-b shrink-0">
        <DetailHeaderCompact
          person={person}
          fullPerson={fullPerson}
          isLoading={isLoading}
        />
        <div className="flex items-center gap-2 mt-1.5 ml-9">
          {/* Sex badge */}
          {!isLoading && fullPerson && (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {tSex(fullPerson.sex)}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={tAdd('ariaLabel')}
                className="ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted active:bg-muted"
              >
                <UserPlus className="size-3" aria-hidden />
                {tAdd('label')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ADD_RELATION_KEYS.map((relation) => (
                <DropdownMenuSub key={relation}>
                  <DropdownMenuSubTrigger>{tAdd('subTrigger', { label: tRelations(relation) })}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'link', relation })}>
                      {tAdd('linkExisting')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'create', relation })}>
                      {tAdd('newPerson')}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => onSeeOnTree(person.id)}
            aria-label={tMobile('treeButtonAriaLabel', { name: `${person.givenName} ${person.surname}` })}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted active:bg-muted"
          >
            <Network className="size-3" aria-hidden />
            {tMobile('treeButton')}
          </button>
        </div>
      </div>

      {/* Full content — scrollable, only accessible at 0.85 snap */}
      <div
        className={`flex-1 ${isFullSnap ? 'overflow-y-auto' : 'overflow-hidden'} pb-[env(safe-area-inset-bottom)]`}
      >
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        ) : (
          <>
            <DetailVitalInfoReadOnly fullPerson={fullPerson} isLoading={isLoading} />
            <DetailFamily
              person={person}
              treeData={treeData}
              onFocusNode={onFocusNode}
            />
            <DetailTimeline events={events} person={person} isLoading={isLoading} />
            <DetailNotesReadOnly notes={fullPerson?.notes} isLoading={isLoading} />
            <DetailSources
              personId={person.id}
              citationCount={citationCount}
              isLoading={isLoading}
            />
          </>
        )}
      </div>

      {dialog?.kind === 'create' && (
        <PersonCreateDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          personId={person.id}
          personName={fullName}
          personSex={personSex}
          relationType={dialog.relation}
          onCreated={handleAfterMutation}
          successAction={{ label: 'Switch to person', onClick: (newId) => onSeeOnTree(newId) }}
        />
      )}
      {dialog?.kind === 'link' && (
        <PersonLinkDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(null); }}
          personId={person.id}
          personName={fullName}
          personSex={personSex}
          relationType={dialog.relation}
          onLinked={handleAfterMutation}
          successAction={{ label: 'Switch to person', onClick: (linkedId) => onSeeOnTree(linkedId) }}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  MobileDetailSheet                                                          */
/* -------------------------------------------------------------------------- */

export function MobileDetailSheet({
  person,
  treeData,
  onClose,
  onFocusNode,
  onSeeOnTree,
}: MobileDetailSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(0.35);

  // Reset to peek snap whenever the selected person changes
  useEffect(() => {
    if (person) {
      setSnap(0.35);
    }
  }, [person?.id]);

  // Radix Dialog (used by Vaul) sets pointer-events:none on <body> when open.
  // For our non-modal drawer this blocks touch on the canvas underneath.
  // Counteract by observing and removing the style.
  useEffect(() => {
    if (!person) return;
    const restore = () => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.removeProperty('pointer-events');
      }
    };
    restore();
    const obs = new MutationObserver(restore);
    obs.observe(document.body, { attributeFilter: ['style'] });
    return () => obs.disconnect();
  }, [person]);

  return (
    <Drawer
      open={!!person}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      snapPoints={[0.35, 0.85]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      fadeFromIndex={1}
      modal={false}
      shouldScaleBackground={false}
    >
      {/* overlay={false}: skip opaque overlay so canvas stays visible and touchable */}
      <DrawerContent overlay={false} className="data-[vaul-drawer-direction=bottom]:h-dvh data-[vaul-drawer-direction=bottom]:max-h-dvh">
        {person && (
          <SheetContent
            person={person}
            treeData={treeData}
            snap={snap}
            onFocusNode={onFocusNode}
            onSeeOnTree={onSeeOnTree}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}
