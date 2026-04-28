'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Person, Event as PersonEvent, PersonListItem, TreeData } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen } from 'lucide-react';
import { personDetailCache, type PersonDetailEntry } from '@/lib/tree/person-detail-cache';

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
      if (r && !cancelled) setData(entryToState(r.entry));
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

export function DetailFamily({
  person, treeData, onFocusNode,
}: {
  person: PersonListItem;
  treeData: TreeData;
  onFocusNode: (personId: string) => void;
}) {
  const { families, childLinks, persons } = treeData;
  const personMap = new Map(persons.map((p) => [p.id, p]));

  // Spouses
  const spouses: PersonListItem[] = [];
  for (const fam of families) {
    if (fam.partner1Id === person.id && fam.partner2Id) {
      const s = personMap.get(fam.partner2Id); if (s) spouses.push(s);
    } else if (fam.partner2Id === person.id && fam.partner1Id) {
      const s = personMap.get(fam.partner1Id); if (s) spouses.push(s);
    }
  }

  // Parents
  const parents: PersonListItem[] = [];
  const childFamIds = childLinks.filter((cl) => cl.personId === person.id).map((cl) => cl.familyId);
  for (const famId of childFamIds) {
    const fam = families.find((f) => f.id === famId);
    if (!fam) continue;
    if (fam.partner1Id) { const p = personMap.get(fam.partner1Id); if (p && !parents.some(e => e.id === p.id)) parents.push(p); }
    if (fam.partner2Id) { const p = personMap.get(fam.partner2Id); if (p && !parents.some(e => e.id === p.id)) parents.push(p); }
  }

  // Children
  const childrenList: PersonListItem[] = [];
  const partnerFamIds = families.filter((f) => f.partner1Id === person.id || f.partner2Id === person.id).map((f) => f.id);
  for (const famId of partnerFamIds) {
    for (const k of childLinks.filter((cl) => cl.familyId === famId)) {
      const c = personMap.get(k.personId);
      if (c && !childrenList.some((e) => e.id === c.id)) childrenList.push(c);
    }
  }

  if (spouses.length === 0 && parents.length === 0 && childrenList.length === 0) {
    return (
      <div className="border-b p-4 text-sm text-muted-foreground">
        No relationships recorded
      </div>
    );
  }

  function RelRow({
    label, people, labelFn,
  }: {
    label: string;
    people: PersonListItem[];
    labelFn?: (p: PersonListItem) => string;
  }) {
    if (people.length === 0) return null;
    return (
      <div className="space-y-1">
        {people.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className="w-14 text-xs text-muted-foreground shrink-0">
              {labelFn ? labelFn(p) : (i === 0 ? label : '')}
            </span>
            <MiniAvatar person={p} />
            <button
              onPointerEnter={() => { void personDetailCache.prefetch(p.id); }}
              onPointerDown={() => { void personDetailCache.prefetch(p.id); }}
              onFocus={() => { void personDetailCache.prefetch(p.id); }}
              onClick={() => onFocusNode(p.id)}
              className="text-sm text-left text-primary underline-offset-4 hover:underline truncate"
            >
              {p.givenName} {p.surname}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border-b p-4 space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Family</div>
      <RelRow label="Spouse" people={spouses} />
      <RelRow
        label="Father/Mother"
        people={parents}
        labelFn={(p) => (p.sex === 'F' ? 'Mother' : 'Father')}
      />
      <RelRow label="Children" people={childrenList} />
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
}

export function DetailTimeline({
  events, person, isLoading,
}: {
  events: PersonEvent[];
  person: PersonListItem;
  isLoading: boolean;
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
    });
  }

  if (person.deathDate) {
    items.push({ type: 'Death', date: person.deathDate, place: null, isPrimary: true });
  }

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, 6);
  const hasMore = items.length > 6 && !expanded;

  return (
    <div className="border-b p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Life Events</div>
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
              <div className="min-w-0">
                <div className="text-[11px] font-medium">{item.type}</div>
                <div className="text-[10px] text-muted-foreground">
                  {[item.date, item.place].filter(Boolean).join(' \u00b7 ') || 'No details'}
                </div>
              </div>
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
