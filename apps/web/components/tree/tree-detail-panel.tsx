'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Person, Event as PersonEvent, PersonListItem, TreeData } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X, Pencil, Search, FileText, UserPlus, BookOpen,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  usePersonDetail                                                           */
/* -------------------------------------------------------------------------- */

interface PersonDetail {
  person: Person | null;
  events: PersonEvent[];
  citationCount: number;
  isLoading: boolean;
}

function usePersonDetail(personId: string): PersonDetail & { refresh: () => void } {
  const [data, setData] = useState<PersonDetail>({
    person: null, events: [], citationCount: 0, isLoading: true,
  });

  const fetchData = useCallback(async () => {
    setData((prev) => ({ ...prev, isLoading: true }));
    try {
      const [personRes, eventsRes, citationsRes] = await Promise.all([
        fetch(`/api/persons/${personId}`),
        fetch(`/api/persons/${personId}/events`),
        fetch(`/api/persons/${personId}/citations-count`),
      ]);
      const [person, events, citations] = await Promise.all([
        personRes.ok ? personRes.json() : null,
        eventsRes.ok ? eventsRes.json() : [],
        citationsRes.ok ? citationsRes.json() : { count: 0 },
      ]);
      setData({ person, events, citationCount: citations.count, isLoading: false });
    } catch {
      setData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [personId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { ...data, refresh: fetchData };
}

/* -------------------------------------------------------------------------- */
/*  useInlineEdit                                                             */
/* -------------------------------------------------------------------------- */

interface InlineEditState {
  isEditMode: boolean;
  editingField: string | null;
  editValue: string;
  isSaving: boolean;
}

function useInlineEdit(personId: string, onSaved: () => void) {
  const [state, setState] = useState<InlineEditState>({
    isEditMode: false, editingField: null, editValue: '', isSaving: false,
  });

  const toggleEdit = useCallback(() => {
    setState((prev) => ({
      ...prev, isEditMode: !prev.isEditMode, editingField: null, editValue: '',
    }));
  }, []);

  const startEdit = useCallback((field: string, currentValue: string) => {
    setState((prev) => ({ ...prev, editingField: field, editValue: currentValue }));
  }, []);

  const cancelEdit = useCallback(() => {
    setState((prev) => ({ ...prev, editingField: null, editValue: '' }));
  }, []);

  const setEditValue = useCallback((value: string) => {
    setState((prev) => ({ ...prev, editValue: value }));
  }, []);

  const saveField = useCallback(async () => {
    if (!state.editingField) return;
    setState((prev) => ({ ...prev, isSaving: true }));
    try {
      const res = await fetch(`/api/persons/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [state.editingField]: state.editValue }),
      });
      if (res.ok) {
        onSaved();
        setState((prev) => ({ ...prev, editingField: null, editValue: '', isSaving: false }));
      } else {
        setState((prev) => ({ ...prev, isSaving: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [personId, state.editingField, state.editValue, onSaved]);

  return { ...state, toggleEdit, startEdit, cancelEdit, setEditValue, saveField };
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

const sexTokens = {
  M: { bg: 'var(--sex-male-bg)', text: 'var(--sex-male)' },
  F: { bg: 'var(--sex-female-bg)', text: 'var(--sex-female)' },
  U: { bg: 'var(--sex-unknown-bg)', text: 'var(--sex-unknown)' },
} as const;

function computeLifespan(birthDate?: string | null, deathDate?: string | null): string {
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

function getInitials(givenName: string, surname: string): string {
  return `${givenName[0] ?? ''}${surname[0] ?? ''}`.toUpperCase();
}

function formatEventType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

/* -------------------------------------------------------------------------- */
/*  DetailHeader                                                              */
/* -------------------------------------------------------------------------- */

function DetailHeader({
  person, fullPerson, isLoading, onClose,
}: {
  person: PersonListItem;
  fullPerson: Person | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  const sex = fullPerson?.sex ?? person.sex;
  const tokens = sexTokens[sex];
  const birthDate = fullPerson?.birthDate ?? person.birthDate;
  const deathDate = fullPerson?.deathDate ?? person.deathDate;

  return (
    <div className="flex items-start justify-between border-b p-4 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div
          className="size-12 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{ backgroundColor: tokens.bg, color: tokens.text }}
        >
          {getInitials(person.givenName, person.surname)}
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold truncate">
            {person.givenName} {person.surname}
          </h2>
          {isLoading ? (
            <Skeleton className="h-3.5 w-36 mt-1" />
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {computeLifespan(birthDate, deathDate)}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {sexLabel[sex]}
            </Badge>
            {person.isLiving && (
              <Badge className="text-[10px] px-1.5 py-0">Living</Badge>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onClose}
        aria-label="Close detail panel"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailActionStrip                                                         */
/* -------------------------------------------------------------------------- */

function DetailActionStrip({
  personId, isEditMode, onToggleEdit,
}: {
  personId: string;
  isEditMode: boolean;
  onToggleEdit: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-muted/30 border-b">
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 text-xs gap-1.5 ${isEditMode ? 'text-primary' : ''}`}
        onClick={onToggleEdit}
      >
        <Pencil className="size-3.5" />
        {isEditMode ? 'Done' : 'Edit'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => router.push(`/persons/${personId}`)}
      >
        <Search className="size-3.5" />
        Research
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => router.push(`/persons/${personId}/edit`)}
      >
        <FileText className="size-3.5" />
        Full Page
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
            <UserPlus className="size-3.5" />
            Add Relation
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/persons/new?relation=spouse&of=${personId}`}>Add Spouse</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/persons/new?relation=father&of=${personId}`}>Add Father</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/persons/new?relation=mother&of=${personId}`}>Add Mother</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/persons/new?relation=child&of=${personId}`}>Add Child</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  EditableField                                                             */
/* -------------------------------------------------------------------------- */

function EditableField({
  field, value, editState, label,
}: {
  field: string;
  value: string;
  editState: ReturnType<typeof useInlineEdit>;
  label?: string;
}) {
  const isEditing = editState.editingField === field;
  const isEmpty = !value;

  if (isEditing) {
    return (
      <Input
        autoFocus
        className="h-7 text-sm"
        value={editState.editValue}
        onChange={(e) => editState.setEditValue(e.target.value)}
        onBlur={() => editState.saveField()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') editState.saveField();
          if (e.key === 'Escape') editState.cancelEdit();
        }}
        disabled={editState.isSaving}
        placeholder={label}
      />
    );
  }

  if (isEmpty && editState.isEditMode) {
    return (
      <button
        className="text-xs text-muted-foreground hover:text-foreground"
        onClick={() => editState.startEdit(field, '')}
      >
        Not recorded +
      </button>
    );
  }

  if (isEmpty) return null;

  if (editState.isEditMode) {
    return (
      <button
        className="text-sm text-left hover:ring-1 hover:ring-border rounded px-1 -mx-1"
        onClick={() => editState.startEdit(field, value)}
      >
        {value}
      </button>
    );
  }

  return <span className="text-sm">{value}</span>;
}

/* -------------------------------------------------------------------------- */
/*  DetailVitalInfo                                                           */
/* -------------------------------------------------------------------------- */

function DetailVitalInfo({
  fullPerson, isLoading, editState,
}: {
  fullPerson: Person | null;
  isLoading: boolean;
  editState: ReturnType<typeof useInlineEdit>;
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

  const showDeath = !fullPerson.isLiving || editState.isEditMode;

  return (
    <div className="border-b p-4 space-y-2 text-sm">
      {/* Birth */}
      <div className="flex items-baseline gap-2">
        <span className="w-10 text-xs text-muted-foreground shrink-0">Born</span>
        <span className="font-medium">
          <EditableField field="birthDate" value={fullPerson.birthDate ?? ''} editState={editState} label="Birth date" />
        </span>
      </div>
      <div className="ml-12">
        <EditableField field="birthPlace" value={fullPerson.birthPlace ?? ''} editState={editState} label="Birth place" />
      </div>

      {/* Death */}
      {showDeath && (
        <>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="w-10 text-xs text-muted-foreground shrink-0">Died</span>
            <span className="font-medium">
              <EditableField field="deathDate" value={fullPerson.deathDate ?? ''} editState={editState} label="Death date" />
            </span>
          </div>
          <div className="ml-12">
            <EditableField field="deathPlace" value={fullPerson.deathPlace ?? ''} editState={editState} label="Death place" />
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailFamily                                                              */
/* -------------------------------------------------------------------------- */

function MiniAvatar({ person: p }: { person: PersonListItem }) {
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

function DetailFamily({
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

  function RelRow({ label, people }: { label: string; people: PersonListItem[] }) {
    if (people.length === 0) return null;
    return (
      <div className="space-y-1">
        {people.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <span className="w-14 text-xs text-muted-foreground shrink-0">
              {people.indexOf(p) === 0 ? label : ''}
            </span>
            <MiniAvatar person={p} />
            <button
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
      <RelRow label="Spouse" people={spouses} />
      {parents.map((p, i) => (
        <div key={p.id} className="flex items-center gap-2">
          <span className="w-14 text-xs text-muted-foreground shrink-0">
            {i === 0 ? (p.sex === 'F' ? 'Mother' : 'Father') : (p.sex === 'F' ? 'Mother' : 'Father')}
          </span>
          <MiniAvatar person={p} />
          <button
            onClick={() => onFocusNode(p.id)}
            className="text-sm text-left text-primary underline-offset-4 hover:underline truncate"
          >
            {p.givenName} {p.surname}
          </button>
        </div>
      ))}
      <RelRow label="Children" people={childrenList} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  DetailTimeline                                                            */
/* -------------------------------------------------------------------------- */

interface TimelineItem {
  type: string;
  date: string | null;
  place: string | null;
  isPrimary: boolean;
}

function DetailTimeline({
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
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[4px] top-1 bottom-1 w-px bg-border" />

        <div className="space-y-3">
          {visible.map((item, i) => (
            <div key={i} className="relative flex items-start gap-2">
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
            </div>
          ))}
        </div>

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
/*  DetailNotes                                                               */
/* -------------------------------------------------------------------------- */

function DetailNotes({
  notes, isLoading, editState,
}: {
  notes: string | null | undefined;
  isLoading: boolean;
  editState: ReturnType<typeof useInlineEdit>;
}) {
  const [showFull, setShowFull] = useState(false);
  const isEditing = editState.editingField === 'notes';
  const text = notes ?? '';

  if (isLoading) {
    return (
      <div className="border-b p-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3 mt-1" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="border-b p-4">
        <Textarea
          autoFocus
          className="text-sm min-h-[80px]"
          value={editState.editValue}
          onChange={(e) => editState.setEditValue(e.target.value)}
          onBlur={() => editState.saveField()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') editState.cancelEdit();
          }}
          disabled={editState.isSaving}
          placeholder="Add notes..."
        />
      </div>
    );
  }

  if (!text && editState.isEditMode) {
    return (
      <div className="border-b p-4">
        <button
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => editState.startEdit('notes', '')}
        >
          No notes — click to add
        </button>
      </div>
    );
  }

  if (!text) return null;

  const isLong = text.length > 150;

  return (
    <div className="border-b p-4">
      <div
        className={`text-sm text-muted-foreground ${!showFull && isLong ? 'line-clamp-3' : ''} ${
          editState.isEditMode ? 'hover:ring-1 hover:ring-border rounded px-1 -mx-1 cursor-pointer' : ''
        }`}
        onClick={editState.isEditMode ? () => editState.startEdit('notes', text) : undefined}
      >
        {text}
      </div>
      {isLong && !showFull && !editState.isEditMode && (
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

/* -------------------------------------------------------------------------- */
/*  DetailSources                                                             */
/* -------------------------------------------------------------------------- */

function DetailSources({
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
/*  Main Component                                                            */
/* -------------------------------------------------------------------------- */

interface TreeDetailPanelProps {
  person: PersonListItem;
  treeData: TreeData;
  onClose: () => void;
  onFocusNode: (personId: string) => void;
}

export function TreeDetailPanel({ person, treeData, onClose, onFocusNode }: TreeDetailPanelProps) {
  const { person: fullPerson, events, citationCount, isLoading, refresh } = usePersonDetail(person.id);
  const editState = useInlineEdit(person.id, refresh);

  return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card overflow-y-auto">
      <DetailHeader person={person} fullPerson={fullPerson} isLoading={isLoading} onClose={onClose} />
      <DetailActionStrip personId={person.id} isEditMode={editState.isEditMode} onToggleEdit={editState.toggleEdit} />
      <DetailVitalInfo fullPerson={fullPerson} isLoading={isLoading} editState={editState} />
      <DetailFamily person={person} treeData={treeData} onFocusNode={onFocusNode} />
      <DetailTimeline events={events} person={person} isLoading={isLoading} />
      <DetailNotes notes={fullPerson?.notes} isLoading={isLoading} editState={editState} />
      <DetailSources personId={person.id} citationCount={citationCount} isLoading={isLoading} />
    </div>
  );
}
