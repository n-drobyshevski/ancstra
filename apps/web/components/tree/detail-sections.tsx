'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Person, Event as PersonEvent, PersonListItem, TreeData } from '@ancstra/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Link2, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { personDetailCache, type PersonDetailEntry } from '@/lib/tree/person-detail-cache';
import type { RelationType } from '@/components/person-link-dialog';
import { RoleGate } from '@/components/auth/role-gate';

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
  // The setData calls here synchronize local state with personDetailCache
  // (an external store with subscribe/read semantics) — allowed per the rule's
  // "subscribe to external state" exception.
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const refresh = useCallback(() => {
    personDetailCache.invalidate(personId);
    void personDetailCache.prefetch(personId).then((entry) => setData(entryToState(entry)));
  }, [personId]);

  return { ...data, refresh };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Default English sex labels. Treat as the source-of-truth fallback used by
 * tests and any non-React caller. UI components should resolve labels via
 * `useSexLabel()` so they stay locale-aware.
 */
export const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

export const sexTokens = {
  M: { bg: 'var(--sex-male-bg)', text: 'var(--sex-male)' },
  F: { bg: 'var(--sex-female-bg)', text: 'var(--sex-female)' },
  U: { bg: 'var(--sex-unknown-bg)', text: 'var(--sex-unknown)' },
} as const;

/** Locale-aware lookup for the M/F/U sex label. Mirrors `sexLabel`. */
export function useSexLabel(): Record<'M' | 'F' | 'U', string> {
  const t = useTranslations('persons.table.sex');
  return { M: t('M'), F: t('F'), U: t('U') };
}

export interface LifespanStrings {
  noDates: string;
  ageSuffix: (years: number) => string;
  birthPrefix: (date: string) => string;
  deathPrefix: (date: string) => string;
}

/**
 * Pure computeLifespan \u2014 caller supplies translated strings. Returns
 * "1842 \u2013 1917 \u00b7 75 years" / "1842 \u2013 1917" / "b. 1842" / "d. 1917" / fallback.
 */
export function computeLifespan(
  birthDate: string | null | undefined,
  deathDate: string | null | undefined,
  s: LifespanStrings,
): string {
  if (birthDate && deathDate) {
    const byMatch = birthDate.match(/\b(\d{4})\b/);
    const dyMatch = deathDate.match(/\b(\d{4})\b/);
    if (byMatch && dyMatch) {
      const age = parseInt(dyMatch[1]) - parseInt(byMatch[1]);
      return `${birthDate} \u2013 ${deathDate} \u00b7 ${s.ageSuffix(age)}`;
    }
    return `${birthDate} \u2013 ${deathDate}`;
  }
  if (birthDate) return s.birthPrefix(birthDate);
  if (deathDate) return s.deathPrefix(deathDate);
  return s.noDates;
}

/** Hook wrapper \u2014 pulls translated strings from context and binds the formatter. */
export function useComputeLifespan(): (
  birthDate?: string | null,
  deathDate?: string | null,
) => string {
  const t = useTranslations('tree.detail.lifespan');
  const strings: LifespanStrings = {
    noDates: t('noDates'),
    ageSuffix: (count) => t('ageSuffix', { count }),
    birthPrefix: (date) => t('birthPrefix', { date }),
    deathPrefix: (date) => t('deathPrefix', { date }),
  };
  return (birthDate, deathDate) => computeLifespan(birthDate, deathDate, strings);
}

export function getInitials(givenName: string, surname: string): string {
  return `${givenName[0] ?? ''}${surname[0] ?? ''}`.toUpperCase();
}

/**
 * Format an event type id like "occupation_event" \u2192 "Occupation event".
 * Locale-agnostic fallback. UI surfaces should prefer translated event-type
 * labels where they exist; this is the catch-all.
 */
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

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
      {label}
    </div>
  );
}

interface AddButtonsProps {
  relation: RelationType;
  linkLabel: string;
  newLabel: string;
  editable: boolean;
  onAddRelation?: (kind: 'create' | 'link', relation: RelationType) => void;
}

function AddButtons({
  relation,
  linkLabel,
  newLabel,
  editable,
  onAddRelation,
}: AddButtonsProps) {
  if (!editable || !onAddRelation) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 ml-14">
      <RoleGate permission="family:create">
        <button
          type="button"
          onClick={() => onAddRelation('link', relation)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Link2 className="size-3" /> {linkLabel}
        </button>
      </RoleGate>
      <RoleGate permission="family:create">
        <button
          type="button"
          onClick={() => onAddRelation('create', relation)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <UserPlus className="size-3" /> {newLabel}
        </button>
      </RoleGate>
    </div>
  );
}

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

  const t = useTranslations('tree.detail.family');
  const tLabels = useTranslations('tree.detail.family.labels');
  const tAdd = useTranslations('tree.detail.family.addButtons');
  const tRowActions = useTranslations('tree.detail.family.rowActions');
  const tRemove = useTranslations('tree.detail.family.remove');

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
        {t('noRelationships')}
      </div>
    );
  }

  async function handleRemove(row: FamilyRow) {
    const personLabel = `${row.person.givenName} ${row.person.surname}`;
    const action =
      row.kind === 'spouse' ? tRemove('spouseConfirm', { name: personLabel })
      : row.kind === 'parent' ? tRemove('parentConfirm', { name: personLabel })
      : row.kind === 'child' ? tRemove('childConfirm', { name: personLabel })
      : tRemove('siblingConfirm', { name: personLabel });
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
      toast.error(tRemove('networkError'));
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || tRemove('failed'));
      return;
    }
    toast.success(tRemove('success', { name: personLabel }));
    onMutated?.();
  }

  function RowActions({ row }: { row: FamilyRow }) {
    if (!editable) return null;
    const fullName = `${row.person.givenName} ${row.person.surname}`;
    return (
      <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => router.push(`/persons/${row.person.id}?view=record`)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={tRowActions('editTitle', { name: row.person.givenName })}
          aria-label={tRowActions('editAria', { fullName })}
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => void handleRemove(row)}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title={tRowActions('removeTitle', { name: row.person.givenName })}
          aria-label={tRowActions('removeAria', { fullName })}
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

  return (
    <div className="border-b p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">{t('heading')}</div>

      {/* Spouses */}
      {(spouseRows.length > 0 || editable) && (
        <div className="space-y-1">
          {spouseRows.length > 0 ? (
            spouseRows.map((row, i) => (
              <PersonRow key={row.person.id} row={row} label={i === 0 ? tLabels('spouse') : ''} />
            ))
          ) : (
            <SectionHeader label={tLabels('spouse')} />
          )}
          <AddButtons relation="spouse" linkLabel={tAdd('linkExisting')} newLabel={tAdd('new')} editable={editable} onAddRelation={onAddRelation} />
        </div>
      )}

      {/* Parents — split add buttons into father/mother slots like RecordTab */}
      {(parentRows.length > 0 || editable) && (
        <div className="space-y-1">
          {parentRows.length > 0 ? (
            parentRows.map((row) => (
              <PersonRow key={row.person.id} row={row} label={row.person.sex === 'F' ? tLabels('mother') : tLabels('father')} />
            ))
          ) : (
            <SectionHeader label={tLabels('parents')} />
          )}
          {editable && (!hasFather || !hasMother) && (
            <div className="flex flex-wrap items-center gap-1 ml-14">
              {!hasFather && (
                <>
                  <RoleGate permission="family:create">
                    <button
                      type="button"
                      onClick={() => onAddRelation!('link', 'father')}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Link2 className="size-3" /> {tAdd('linkFather')}
                    </button>
                  </RoleGate>
                  <RoleGate permission="family:create">
                    <button
                      type="button"
                      onClick={() => onAddRelation!('create', 'father')}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <UserPlus className="size-3" /> {tAdd('father')}
                    </button>
                  </RoleGate>
                </>
              )}
              {!hasMother && (
                <>
                  <RoleGate permission="family:create">
                    <button
                      type="button"
                      onClick={() => onAddRelation!('link', 'mother')}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Link2 className="size-3" /> {tAdd('linkMother')}
                    </button>
                  </RoleGate>
                  <RoleGate permission="family:create">
                    <button
                      type="button"
                      onClick={() => onAddRelation!('create', 'mother')}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <UserPlus className="size-3" /> {tAdd('mother')}
                    </button>
                  </RoleGate>
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
              <PersonRow key={row.person.id} row={row} label={i === 0 ? tLabels('children') : ''} />
            ))
          ) : (
            <SectionHeader label={tLabels('children')} />
          )}
          <AddButtons relation="child" linkLabel={tAdd('linkExisting')} newLabel={tAdd('new')} editable={editable} onAddRelation={onAddRelation} />
        </div>
      )}

      {/* Siblings */}
      {(siblingRows.length > 0 || editable) && (
        <div className="space-y-1">
          {siblingRows.length > 0 ? (
            siblingRows.map((row, i) => (
              <PersonRow key={row.person.id} row={row} label={i === 0 ? tLabels('siblings') : ''} />
            ))
          ) : (
            <SectionHeader label={tLabels('siblings')} />
          )}
          <AddButtons relation="sibling" linkLabel={tAdd('linkExisting')} newLabel={tAdd('new')} editable={editable} onAddRelation={onAddRelation} />
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
  const t = useTranslations('tree.detail.timeline');
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
    items.push({ type: t('birth'), date: person.birthDate, place: null, isPrimary: true });
  }

  for (const ev of events) {
    const evType = ev.eventType.toLowerCase();
    if (evType === 'birth' || evType === 'death') continue;
    items.push({
      type: formatEventType(ev.eventType),
      date: ev.dateOriginal,
      place: ev.placeText,
      isPrimary: false,
      event: ev,
    });
  }

  if (person.deathDate) {
    items.push({ type: t('death'), date: person.deathDate, place: null, isPrimary: true });
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
    if (!confirm(t('deleteConfirm', { type: label.toLowerCase() }))) return;
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('deleteFailed'));
        return;
      }
      toast.success(t('deleteSuccess'));
      onMutated?.();
    } catch {
      toast.error(t('networkError'));
    }
  }

  return (
    <div className="border-b p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t('heading')}</div>
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
                    {[item.date, item.place].filter(Boolean).join(' \u00b7 ') || t('noDetails')}
                  </div>
                </div>
                {/* Edit/Delete only for real (non-primary) event rows in edit mode.
                    Birth/Death are derived from vital info and are edited via the
                    Vital Information section. */}
                {canEditRow && item.event && (
                  <div className="ml-auto flex items-center gap-0.5 shrink-0">
                    <RoleGate permission="event:edit">
                      <button
                        type="button"
                        onClick={() => onEditEvent!(item.event!)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title={t('editTitle')}
                        aria-label={t('editAria', { type: item.type })}
                      >
                        <Pencil className="size-3" />
                      </button>
                    </RoleGate>
                    <RoleGate permission="event:delete">
                      <button
                        type="button"
                        onClick={() => void handleDeleteEvent(item.event!)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title={t('deleteTitle')}
                        aria-label={t('deleteAria', { type: item.type })}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </RoleGate>
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
              {t('showAll', { count: items.length })}
            </button>
          )}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">{t('noEvents')}</div>
      )}

      {editable && (
        <RoleGate permission="event:create">
          <button
            type="button"
            onClick={onAddEvent}
            className="mt-3 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span aria-hidden>+</span> {t('addEvent')}
          </button>
        </RoleGate>
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
  const t = useTranslations('tree.detail.sources');
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
        <span>{t('count', { count: citationCount })}</span>
      </div>
      <Link
        href={`/persons/${personId}`}
        className="text-xs text-primary hover:underline"
      >
        {t('viewAll')}
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
  const t = useTranslations('tree.detail.vital');
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
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t('heading')}</div>
      {/* Birth */}
      <div className="flex items-baseline gap-2">
        <span className="w-10 text-xs text-muted-foreground shrink-0">{t('born')}</span>
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
            <span className="w-10 text-xs text-muted-foreground shrink-0">{t('died')}</span>
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
  const tLifespan = useTranslations('tree.detail.lifespan');
  const formatLifespan = useComputeLifespan();
  const sex = fullPerson?.sex ?? person.sex;
  const tokens = sexTokens[sex];
  const birthDate = fullPerson?.birthDate ?? person.birthDate;
  const deathDate = fullPerson?.deathDate ?? person.deathDate;
  const birthPlace = fullPerson?.birthPlace;
  const deathPlace = fullPerson?.deathPlace;

  const compactPlaceLine = [
    birthDate && `${tLifespan('birthPrefix', { date: birthDate })}${birthPlace ? `, ${birthPlace}` : ''}`,
    deathDate && `${tLifespan('deathPrefix', { date: deathDate })}${deathPlace ? `, ${deathPlace}` : ''}`,
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
            {formatLifespan(birthDate, deathDate)}
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
  const t = useTranslations('tree.detail.notes');
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
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t('heading')}</div>
      <div className={`text-sm text-muted-foreground ${!showFull && isLong ? 'line-clamp-3' : ''}`}>
        {text}
      </div>
      {isLong && !showFull && (
        <button
          className="text-xs text-primary mt-1 hover:underline"
          onClick={() => setShowFull(true)}
        >
          {t('more')}
        </button>
      )}
    </div>
  );
}
