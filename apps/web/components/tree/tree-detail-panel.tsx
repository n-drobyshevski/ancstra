'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Person, PersonListItem, TreeData } from '@ancstra/shared';
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
  X, Pencil, Search, FileText, UserPlus, Network,
} from 'lucide-react';
import {
  usePersonDetail,
  sexLabel,
  sexTokens,
  computeLifespan,
  getInitials,
  formatEventType,
  MiniAvatar,
  DetailFamily,
  DetailTimeline,
  DetailSources,
} from './detail-sections';
import { personDetailCache } from '@/lib/tree/person-detail-cache';

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
        personDetailCache.invalidate(personId);
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
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
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
  personId, isEditMode, onToggleEdit, onSeeOnTree,
}: {
  personId: string;
  isEditMode: boolean;
  onToggleEdit: () => void;
  onSeeOnTree: (personId: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-muted/30 border-b">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => onSeeOnTree(personId)}
      >
        <Network className="size-3.5" />
        View on tree
      </Button>
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
        onClick={() => router.push(`/persons/${personId}`)}
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
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Vital Information</div>
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
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Notes</div>
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
/*  Main Component                                                            */
/* -------------------------------------------------------------------------- */

interface TreeDetailPanelProps {
  person: PersonListItem;
  treeData: TreeData;
  onClose: () => void;
  onFocusNode: (personId: string) => void;
  onSeeOnTree: (personId: string) => void;
}

export function TreeDetailPanel({ person, treeData, onClose, onFocusNode, onSeeOnTree }: TreeDetailPanelProps) {
  const { person: fullPerson, events, citationCount, isLoading, refresh } = usePersonDetail(person.id);
  const editState = useInlineEdit(person.id, refresh);

  return (
    <div className="w-[400px] shrink-0 border-l border-border bg-card overflow-y-auto">
      <DetailHeader person={person} fullPerson={fullPerson} isLoading={isLoading} onClose={onClose} />
      <DetailActionStrip
        personId={person.id}
        isEditMode={editState.isEditMode}
        onToggleEdit={editState.toggleEdit}
        onSeeOnTree={onSeeOnTree}
      />
      <DetailVitalInfo fullPerson={fullPerson} isLoading={isLoading} editState={editState} />
      <DetailFamily person={person} treeData={treeData} onFocusNode={onFocusNode} />
      <DetailTimeline events={events} person={person} isLoading={isLoading} />
      <DetailNotes notes={fullPerson?.notes} isLoading={isLoading} editState={editState} />
      <DetailSources personId={person.id} citationCount={citationCount} isLoading={isLoading} />
    </div>
  );
}
