'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Person, Event as PersonEvent, PersonListItem, TreeData } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Link2, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { personDetailCache, type PersonDetailEntry } from '@/lib/tree/person-detail-cache';
import type { RelationType } from '@/components/person-link-dialog';

/* -------------------------------------------------------------------------- */
/*  usePersonDetail                                                            */
/* -------------------------------------------------------------------------- */

export interface PersonDetailState {
  person: Person | null;
  events: PersonEvent[];
  citationCount: number;
  isLoading: boolean;
}

function entryToState(entry: PersonDetailEntry): PersonDetailState {
  return {
    person: entry.data,
    events: entry.data?.events ?? [],
    citationCount: entry.citationCount,
    isLoading: false,
  };
}

export function usePersonDetail(personId: string): PersonDetailState & { refresh: () => void } {
  const [data, setData] = useState<PersonDetailState>(() => {
    const read = personDetailCache.read(personId);
    return read
      ? entryToState(read.entry)
      : { person: null, events: [], citationCount: 0, isLoading: true };
  });

  // Sync state when personId changes (covers panel re-use across selections).
  useEffect(() => {
    let cancelled = false;
    const read = personDetailCache.read(personId);
    if (read) {
      setData(entryToState(read.entry));
      if (read.isStale) {
        // Background revalidation — subscribe handles the swap.
        void personDetailCache.prefetch(personId);
      }
    } else {
      setData({ person: null, events: [], citationCount: 0, isLoading: true });
      personDetailCache.prefetch(personId).then((entry) => {
        if (!cancelled) setData(entryToState(entry));
      }).catch(() => {
        if (!cancelled) setData((prev) => ({ ...prev, isLoading: false }));
      });
    }

    const unsubscribe = personDetailCache.subscribe(personId, () => {
      const r = personDetailCache.read(personId);
      if (!r || cancelled) return;
      setData(entryToState(r.entry));
      if (r.isStale) {
        // Stale flag was set externally (e.g. window-focus invalidateAll);
        // kick off a background revalidation. Resolution will re-notify with fresh data.
        void personDetailCache.prefetch(personId);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [personId]);

  const refresh = useCallback(() => {
    personDetailCache.invalidate(personId);
    void personDetailCache.prefetch(personId).then((entry) => setData(entryToState(entry)));
  }, [personId]);

  return { ...data, refresh };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

export const sexTokens = {
  M: { bg: 'var(--sex-male-bg)', text: 'var(--sex-male)' },
  F: { bg: 'var(--sex-female-bg)', text: 'var(--sex-female)' },
  U: { bg: 'var(--sex-unknown-bg)', text: 'var(--sex-unknown)' },
} as const;

export function computeLifespan(birthDate?: string | null, deathDate?: string | null): string {
  if (birthDate && deathDate) {
    const byMatch = birthDate.match(/\b(\d{4})\b/);
    const dyMatch = deathDate.match(/\b(\d{4})\b/);
    if (byMatch && dyMatch) {
      const age = parseInt(dyMatch[1]) - parseInt(byMatch[1]);
      return `${birthDate} \u2013 ${deathDate} \u00b7 ${age} years`;
    }
    return `${birthDate} \u2013 ${deathDate}`;
  }
  if (birthDate) return `b. ${birthDate}`;
  if (deathDate) return `d. ${deathDate}`;
  return 'No dates recorded';
}

export function getInitials(givenName: string, surname: string): string {
  return `${givenName[0] ?? ''}${surname[0] ?? ''}`.toUpperCase();
}

export function formatEventType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

/* -------------------------------------------------------------------------- */
/*  MiniAvatar                                                                 */
/* -------------------------------------------------------------------------- */

export function MiniAvatar({ person: p }: { person: PersonListItem }) {
  const tokens = sexTokens[p.sex];
  return (
    <div
      className="size-[22px] shrink-0 rounded-full flex items-center justify-center text-[9px] font-semibold"
      style={{ backgroundColor: tokens.bg, color: tokens.text }}
    >
      {getInitials(p.givenName, p.surname)}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailFamily                                                               */
/* -------------------------------------------------------------------------- */

type SpouseRow = { kind: 'spouse'; person: PersonListItem; familyId: string };
type ParentRow = { kind: 'parent'; person: PersonListItem; familyId: string; slot: 'partner1' | 'partner2' };
type ChildRow = { kind: 'child'; person: PersonListItem; familyId: string };
type SiblingRow = { kind: 'sibling'; person: PersonListItem; familyId: string };
type FamilyRow = SpouseRow | ParentRow | ChildRow | SiblingRow;

export function DetailFamily({
  person, treeData, onFocusNode, editMode = false, onAddRelation, onMutated,
}: {
  person: PersonListItem;
  treeData: TreeData;
  onFocusNode: (personId: string) => void;
  /** When true (and onAddRelation is provided), show inline Link/+ New + edit/remove icons. */
  editMode?: boolean;
  onAddRelation?: (kind: 'create' | 'link', relation: RelationType) => void;
  /** Called after a remove succeeds — parent should refresh data (cache invalidate + router.refresh). */
  onMutated?: () => void;
}) {
  const router = useRouter();
  const { families, childLinks, persons } = treeData;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  // Spouses (with familyId)
  const spouseRows: SpouseRow[] = [];
  for (const fam of families) {
    if (fam.partner1Id === person.id && fam.partner2Id) {
      const s = personMap.get(fam.partner2Id); if (s) spouseRows.push({ kind: 'spouse', person: s, familyId: fam.id });
    } else if (fam.partner2Id === person.id && fam.partner1Id) {
      const s = personMap.get(fam.partner1Id); if (s) spouseRows.push({ kind: 'spouse', person: s, familyId: fam.id });
    }
  }

  // Parents (with familyId + slot)
  const parentRows: ParentRow[] = [];
  const childFamIds = childLinks.filter((cl) => cl.personId === person.id).map((cl) => cl.familyId);
  const seenParentIds = new Set<string>();
  for (const famId of childFamIds) {
    const fam = families.find((f) => f.id === famId);
    if (!fam) continue;
    if (fam.partner1Id && !seenParentIds.has(fam.partner1Id)) {
      const p = personMap.get(fam.partner1Id);
      if (p) { parentRows.push({ kind: 'parent', person: p, familyId: fam.id, slot: 'partner1' }); seenParentIds.add(p.id); }
    }
    if (fam.partner2Id && !seenParentIds.has(fam.partner2Id)) {
      const p = personMap.get(fam.partner2Id);
      if (p) { parentRows.push({ kind: 'parent', person: p, familyId: fam.id, slot: 'partner2' }); seenParentIds.add(p.id); }
    }
  }

  // Children (deduped across partner families — keep the first family the link appears in)
  const childRows: ChildRow[] = [];
  const seenChildIds = new Set<string>();
  const partnerFamIds = families.filter((f) => f.partner1Id === person.id || f.partner2Id === person.id).map((f) => f.id);
  for (const famId of partnerFamIds) {
    for (const k of childLinks.filter((cl) => cl.familyId === famId)) {
      if (seenChildIds.has(k.personId)) continue;
      const c = personMap.get(k.personId);
      if (c) { childRows.push({ kind: 'child', person: c, familyId: famId }); seenChildIds.add(c.id); }
    }
  }

  // Siblings — other children of any of person's parent families
  const siblingRows: SiblingRow[] = [];
  const seenSiblingIds = new Set<string>();
  for (const famId of childFamIds) {
    for (const k of childLinks.filter((cl) => cl.familyId === famId)) {
      if (k.personId === person.id || seenSiblingIds.has(k.personId)) continue;
      const s = personMap.get(k.personId);
      if (s) { siblingRows.push({ kind: 'sibling', person: s, familyId: famId }); seenSiblingIds.add(s.id); }
    }
  }

  const editable = editMode && !!onAddRelation;
  const hasFather = parentRows.some((r) => r.person.sex === 'M');
  const hasMother = parentRows.some((r) => r.person.sex === 'F');

  if (
    !editable &&
    spouseRows.length === 0 &&
    parentRows.length === 0 &&
    childRows.length === 0 &&
    siblingRows.length === 0
  ) {
    return (
      <div className="border-b p-4 text-sm text-muted-foreground">
        No relationships recorded
      </div>
    );
  }

  async function handleRemove(row: FamilyRow) {
    const personLabel = `${row.person.givenName} ${row.person.surname}`;
    const action =
      row.kind === 'spouse' ? `Unlink ${personLabel} as spouse?\nThis will remove the partnership but keep both people.`
      : row.kind === 'parent' ? `Remove ${personLabel} as parent?\nThe co-parent (if any) and any siblings will stay attached.`
      : row.kind === 'child' ? `Remove ${personLabel} as child?\nThe person stays in the tree.`
      : `Remove ${personLabel} as sibling?\nThe person stays in the tree.`;
    if (!confirm(action)) return;

    let res: Response;
    try {
      if (row.kind === 'spouse') {
        res = await fetch(`/api/families/${row.familyId}`, { method: 'DELETE' });
      } else if (row.kind === 'parent') {
        const body = row.slot === 'partner1' ? { partner1Id: null } : { partner2Id: null };
        res = await fetch(`/api/families/${row.familyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        // child or sibling — same endpoint shape
        res = await fetch(`/api/families/${row.familyId}/children/${row.person.id}`, { method: 'DELETE' });
      }
    } catch {
      toast.error('Network error');
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Failed to remove');
      return;
    }
    toast.success(`Removed ${personLabel}`);
    onMutated?.();
  }

  function RowActions({ row }: { row: FamilyRow }) {
    if (!editable) return null;
    return (
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => router.push(`/persons/${row.person.id}?view=record`)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={`Edit ${row.person.givenName}`}
          aria-label={`Edit ${row.person.givenName} ${row.person.surname}`}
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => void handleRemove(row)}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title={`Remove ${row.person.givenName}`}
          aria-label={`Remove ${row.person.givenName} ${row.person.surname}`}
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    );
  }

  function PersonRow({ row, label }: { row: FamilyRow; label: string }) {
    const p = row.person;
    return (
      <div className="flex items-center gap-2">
        <span className="w-14 text-xs text-muted-foreground shrink-0">{label}</span>
        <MiniAvatar person={p} />
        <button
          type="button"
          onPointerEnter={() => { void personDetailCache.prefetch(p.id); }}
          onPointerDown={() => { void personDetailCache.prefetch(p.id); }}
          onFocus={() => { void personDetailCache.prefetch(p.id); }}
          onClick={() => onFocusNode(p.id)}
          className="text-sm text-left text-primary underline-offset-4 hover:underline truncate min-w-0 flex-1"
        >
          {p.givenName} {p.surname}
        </button>
        <RowActions row={row} />
      </div>
    );
  }

  function AddButtons({ relation, linkLabel, newLabel }: { relation: RelationType; linkLabel: string; newLabel: string }) {
    if (!editable) return null;
    return (
      <div className="flex flex-wrap items-center gap-1 ml-14">
        <button
          type="button"
          onClick={() => onAddRelation!('link', relation)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Link2 className="size-3" /> {linkLabel}
        </button>
        <button
          type="button"
          onClick={() => onAddRelation!('create', relation)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <UserPlus className="size-3" /> {newLabel}
        </button>
      </div>
    );
  }

  function SectionHeader({ label }: { label: string }) {
    return (
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
    );
  }

  return (
    <div className="border-b p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Family</div>

      {/* Spouses */}
      {(spouseRows.length > 0 || editable) && (
        <div className="space-y-1">
          {spouseRows.length > 0 ? (
            spouseRows.map((row, i) => (
              <PersonRow key={row.person.id} row={row} label={i === 0 ? 'Spouse' : ''} />
            ))
          ) : (
            <SectionHeader label="Spouse" />
          )}
          <AddButtons relation="spouse" linkLabel="Link existing" newLabel="New" />
        </div>
      )}

      {/* Parents — split add buttons into father/mother slots like RecordTab */}
      {(parentRows.length > 0 || editable) && (
        <div className="space-y-1">
          {parentRows.length > 0 ? (
            parentRows.map((row) => (
              <PersonRow key={row.person.id} row={row} label={row.person.sex === 'F' ? 'Mother' : 'Father'} />
            ))
          ) : (
            <SectionHeader label="Parents" />
          )}
          {editable && (!hasFather || !hasMother) && (
            <div className="flex flex-wrap items-center gap-1 ml-14">
              {!hasFather && (
                <>
                  <button
                    type="button"
                    onClick={() => onAddRelation!('link', 'father')}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Link2 className="size-3" /> Link father
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddRelation!('create', 'father')}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <UserPlus className="size-3" /> Father
                  </button>
                </>
              )}
              {!hasMother && (
                <>
                  <button
                    type="button"
                    onClick={() => onAddRelation!('link', 'mother')}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Link2 className="size-3" /> Link mother
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddRelation!('create', 'mother')}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <UserPlus className="size-3" /> Mother
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Children */}
      {(childRows.length > 0 || editable) && (
        <div className="space-y-1">
          {childRows.length > 0 ? (
            childRows.map((row, i) => (
              <PersonRow key={row.person.id} row={row} label={i === 0 ? 'Children' : ''} />
            ))
          ) : (
            <SectionHeader label="Children" />
          )}
          <AddButtons relation="child" linkLabel="Link existing" newLabel="New" />
        </div>
      )}

      {/* Siblings */}
      {(siblingRows.length > 0 || editable) && (
        <div className="space-y-1">
          {siblingRows.length > 0 ? (
            siblingRows.map((row, i) => (
              <PersonRow key={row.person.id} row={row} label={i === 0 ? 'Siblings' : ''} />
            ))
          ) : (
            <SectionHeader label="Siblings" />
          )}
          <AddButtons relation="sibling" linkLabel="Link existing" newLabel="New" />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailTimeline                                                             */
/* -------------------------------------------------------------------------- */

interface TimelineItem {
  type: string;
  date: string | null;
  place: string | null;
  isPrimary: boolean;
  /** Underlying event row (only set for non-primary timeline items so they can be edited/removed). */
  event?: PersonEvent;
}

export function DetailTimeline({
  events, person, isLoading, editMode = false, onAddEvent, onEditEvent, onMutated,
}: {
  events: PersonEvent[];
  person: PersonListItem;
  isLoading: boolean;
  /** When true (and onAddEvent is provided), render an "+ Add event" affordance. */
  editMode?: boolean;
  onAddEvent?: () => void;
  /** Open the edit dialog for an existing event. Required to expose the per-row pencil icon. */
  onEditEvent?: (event: PersonEvent) => void;
  /** Called after a delete succeeds — parent should refresh data. */
  onMutated?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="border-b p-4 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-36" />
      </div>
    );
  }

  // Build timeline items
  const items: TimelineItem[] = [];

  if (person.birthDate) {
    items.push({ type: 'Birth', date: person.birthDate, place: null, isPrimary: true });
  }

  for (const ev of events) {
    const t = ev.eventType.toLowerCase();
    if (t === 'birth' || t === 'death') continue;
    items.push({
      type: formatEventType(ev.eventType),
      date: ev.dateOriginal,
      place: ev.placeText,
      isPrimary: false,
      event: ev,
    });
  }

  if (person.deathDate) {
    items.push({ type: 'Death', date: person.deathDate, place: null, isPrimary: true });
  }

  const editable = editMode && !!onAddEvent;
  const canEditRow = editMode && !!onEditEvent;

  // Hide the section entirely when there are no events AND we're not in edit
  // mode \u2014 preserves the original "stay quiet when empty" behavior. In edit
  // mode the section always renders so the add button is reachable.
  if (items.length === 0 && !editable) return null;

  const visible = expanded ? items : items.slice(0, 6);
  const hasMore = items.length > 6 && !expanded;

  async function handleDeleteEvent(ev: PersonEvent) {
    const label = formatEventType(ev.eventType);
    if (!confirm(`Delete ${label.toLowerCase()} event?`)) return;
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete event');
        return;
      }
      toast.success('Event deleted');
      onMutated?.();
    } catch {
      toast.error('Network error');
    }
  }

  return (
    <div className="border-b p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Life Events</div>
      {items.length > 0 ? (
        <div className="relative pl-4">
          {/* Vertical line */}
          <div className="absolute left-[4px] top-1 bottom-1 w-px bg-border" />

          <ol className="space-y-3">
            {visible.map((item, i) => (
              <li key={i} className="relative flex items-start gap-2">
                {/* Dot */}
                <div
                  className={`absolute left-[-13px] top-[3px] size-[9px] rounded-full border-2 border-card ${
                    item.isPrimary ? 'bg-primary' : 'bg-muted-foreground'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium">{item.type}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {[item.date, item.place].filter(Boolean).join(' \u00b7 ') || 'No details'}
                  </div>
                </div>
                {/* Edit/Delete only for real (non-primary) event rows in edit mode.
                    Birth/Death are derived from vital info and are edited via the
                    Vital Information section. */}
                {canEditRow && item.event && (
                  <div className="ml-auto flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditEvent!(item.event!)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Edit event"
                      aria-label={`Edit ${item.type} event`}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteEvent(item.event!)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete event"
                      aria-label={`Delete ${item.type} event`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>

          {hasMore && (
            <button
              className="text-[10px] text-primary mt-2 ml-0 hover:underline"
              onClick={() => setExpanded(true)}
            >
              Show all ({items.length})
            </button>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">No events recorded</div>
      )}

      {editable && (
        <button
          type="button"
          onClick={onAddEvent}
          className="mt-3 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <span aria-hidden>+</span> Add event
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailSources                                                              */
/* -------------------------------------------------------------------------- */

export function DetailSources({
  personId, citationCount, isLoading,
}: {
  personId: string;
  citationCount: number;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  return (
    <div className="p-4 flex items-center justify-between text-sm text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <BookOpen className="size-3.5" />
        <span>{citationCount} source citation{citationCount !== 1 ? 's' : ''}</span>
      </div>
      <Link
        href={`/persons/${personId}`}
        className="text-xs text-primary hover:underline"
      >
        View all &rarr;
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailVitalInfoReadOnly  (mobile / read-only variant)                     */
/* -------------------------------------------------------------------------- */

export function DetailVitalInfoReadOnly({
  fullPerson, isLoading,
}: {
  fullPerson: Person | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="border-b p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  if (!fullPerson) return null;

  const showDeath = !fullPerson.isLiving;

  return (
    <div className="border-b p-4 space-y-2 text-sm">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Vital Information</div>
      {/* Birth */}
      <div className="flex items-baseline gap-2">
        <span className="w-10 text-xs text-muted-foreground shrink-0">Born</span>
        <span className="font-medium">
          {fullPerson.birthDate ? <span className="text-sm">{fullPerson.birthDate}</span> : null}
        </span>
      </div>
      {fullPerson.birthPlace && (
        <div className="ml-12">
          <span className="text-sm">{fullPerson.birthPlace}</span>
        </div>
      )}

      {/* Death */}
      {showDeath && (
        <>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="w-10 text-xs text-muted-foreground shrink-0">Died</span>
            <span className="font-medium">
              {fullPerson.deathDate ? <span className="text-sm">{fullPerson.deathDate}</span> : null}
            </span>
          </div>
          {fullPerson.deathPlace && (
            <div className="ml-12">
              <span className="text-sm">{fullPerson.deathPlace}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailHeaderCompact  (mobile peek state)                                  */
/* -------------------------------------------------------------------------- */

export function DetailHeaderCompact({
  person, fullPerson, isLoading,
}: {
  person: PersonListItem;
  fullPerson: Person | null;
  isLoading: boolean;
}) {
  const sex = fullPerson?.sex ?? person.sex;
  const tokens = sexTokens[sex];
  const birthDate = fullPerson?.birthDate ?? person.birthDate;
  const deathDate = fullPerson?.deathDate ?? person.deathDate;
  const birthPlace = fullPerson?.birthPlace;
  const deathPlace = fullPerson?.deathPlace;

  const compactPlaceLine = [
    birthDate && `b. ${birthDate}${birthPlace ? `, ${birthPlace}` : ''}`,
    deathDate && `d. ${deathDate}${deathPlace ? `, ${deathPlace}` : ''}`,
  ].filter(Boolean).join(' \u00b7 ');

  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* 28px avatar */}
      <div
        className="size-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold"
        style={{ backgroundColor: tokens.bg, color: tokens.text }}
      >
        {getInitials(person.givenName, person.surname)}
      </div>
      <div className="min-w-0">
        <span className="text-sm font-semibold truncate">
          {person.givenName} {person.surname}
        </span>
        {isLoading ? (
          <Skeleton className="h-3 w-28 mt-0.5" />
        ) : (
          <span className="text-[11px] text-muted-foreground ml-1.5">
            {computeLifespan(birthDate, deathDate)}
          </span>
        )}
        {!isLoading && fullPerson && (birthPlace || deathPlace) && (
          <div className="truncate text-[10px] text-muted-foreground">
            {compactPlaceLine}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailNotesReadOnly  (mobile / read-only variant)                         */
/* -------------------------------------------------------------------------- */

export function DetailNotesReadOnly({
  notes, isLoading,
}: {
  notes: string | null | undefined;
  isLoading: boolean;
}) {
  const [showFull, setShowFull] = useState(false);
  const text = notes ?? '';

  if (isLoading) {
    return (
      <div className="border-b p-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3 mt-1" />
      </div>
    );
  }

  if (!text) return null;

  const isLong = text.length > 150;

  return (
    <div className="border-b p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Notes</div>
      <div className={`text-sm text-muted-foreground ${!showFull && isLong ? 'line-clamp-3' : ''}`}>
        {text}
      </div>
      {isLong && !showFull && (
        <button
          className="text-xs text-primary mt-1 hover:underline"
          onClick={() => setShowFull(true)}
        >
          more
        </button>
      )}
    </div>
  );
}
