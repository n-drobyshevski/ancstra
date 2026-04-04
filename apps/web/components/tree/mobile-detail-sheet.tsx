'use client';

import { useState, useEffect } from 'react';
import type { PersonListItem, TreeData } from '@ancstra/shared';
import { Drawer, DrawerPortal, DrawerTitle } from '@/components/ui/drawer';
import { Drawer as DrawerPrimitive } from 'vaul';
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

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

interface MobileDetailSheetProps {
  person: PersonListItem | null;
  treeData: TreeData;
  onClose: () => void;
  onFocusNode: (personId: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Inner content — rendered only when a person is selected                   */
/* -------------------------------------------------------------------------- */

function SheetContent({
  person,
  treeData,
  snap,
  onFocusNode,
}: {
  person: PersonListItem;
  treeData: TreeData;
  snap: number | string | null;
  onFocusNode: (personId: string) => void;
}) {
  const { person: fullPerson, events, citationCount, isLoading } = usePersonDetail(person.id);
  const isFullSnap = snap === 0.85;

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
        {/* Sex badge */}
        {!isLoading && fullPerson && (
          <div className="flex items-center gap-2 mt-1.5 ml-9">
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {fullPerson.sex === 'M' ? 'Male' : fullPerson.sex === 'F' ? 'Female' : 'Unknown'}
            </span>
          </div>
        )}
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
      {/*
        Non-modal drawer: use Vaul Content directly WITHOUT the overlay.
        The default DrawerContent renders a full-screen DrawerOverlay that
        sets pointer-events:none on <body>, blocking touch on the canvas.
      */}
      <DrawerPortal>
        <DrawerPrimitive.Content
          data-slot="drawer-content"
          className="group/drawer-content fixed z-50 flex h-auto flex-col bg-popover text-sm text-popover-foreground data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[85dvh] data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=bottom]:border-t"
        >
          <div className="mx-auto mt-4 h-1 w-[100px] shrink-0 rounded-full bg-muted" />
          {person && (
            <SheetContent
              person={person}
              treeData={treeData}
              snap={snap}
              onFocusNode={onFocusNode}
            />
          )}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
