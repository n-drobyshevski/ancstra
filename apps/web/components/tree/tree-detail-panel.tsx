'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Event as PersonEvent, Person, PersonListItem, TreeData } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X, Pencil, Search, FileText, Network,
} from 'lucide-react';
import { PersonCreateDialog } from '@/components/person-create-dialog';
import { PersonLinkDialog, type RelationType } from '@/components/person-link-dialog';
import { EventCreateDialog } from '@/components/event-create-dialog';
import {
  usePersonDetail,
  useSexLabel,
  sexTokens,
  useComputeLifespan,
  getInitials,
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
  const t = useTranslations('tree.detail.header');
  const sexLabel = useSexLabel();
  const formatLifespan = useComputeLifespan();
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
              {formatLifespan(birthDate, deathDate)}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {sexLabel[sex]}
            </Badge>
            {person.isLiving && (
              <Badge className="text-[10px] px-1.5 py-0">{t('livingBadge')}</Badge>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onClose}
        aria-label={t('closeAriaLabel')}
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
  const t = useTranslations('tree.detail.actionStrip');

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 py-2 bg-muted/30 border-b">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => onSeeOnTree(personId)}
      >
        <Network className="size-3.5" />
        {t('focus')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 text-xs gap-1.5 ${isEditMode ? 'text-primary' : ''}`}
        onClick={onToggleEdit}
      >
        <Pencil className="size-3.5" />
        {isEditMode ? t('done') : t('edit')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => router.push(`/persons/${personId}`)}
      >
        <Search className="size-3.5" />
        {t('research')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={() => router.push(`/persons/${personId}`)}
      >
        <FileText className="size-3.5" />
        {t('fullPage')}
      </Button>
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
  const t = useTranslations('tree.detail.editableField');
  const isEditing = editState.editingField === field;
  const isEmpty = !value;
  const labelText = label ?? field;

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
    const lowercase = label ? label.toLowerCase() : field;
    return (
      <button
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => editState.startEdit(field, '')}
        aria-label={t('addAria', { label: labelText })}
      >
        <Pencil className="size-3" />
        {t('addPrefix', { label: lowercase })}
      </button>
    );
  }

  if (isEmpty) return null;

  if (editState.isEditMode) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          className="text-sm text-left hover:ring-1 hover:ring-border rounded px-1 -mx-1"
          onClick={() => editState.startEdit(field, value)}
        >
          {value}
        </button>
        <button
          type="button"
          onClick={() => editState.startEdit(field, value)}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={t('editTitle', { label: labelText })}
          aria-label={t('editAria', { label: labelText })}
        >
          <Pencil className="size-3" />
        </button>
      </span>
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
  const t = useTranslations('tree.detail.vital');
  const tFields = useTranslations('tree.detail.vital.fields');

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
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t('heading')}</div>
      {/* Birth */}
      <div className="flex items-baseline gap-2">
        <span className="w-10 text-xs text-muted-foreground shrink-0">{t('born')}</span>
        <span className="font-medium">
          <EditableField field="birthDate" value={fullPerson.birthDate ?? ''} editState={editState} label={tFields('birthDate')} />
        </span>
      </div>
      <div className="ml-12">
        <EditableField field="birthPlace" value={fullPerson.birthPlace ?? ''} editState={editState} label={tFields('birthPlace')} />
      </div>

      {/* Death */}
      {showDeath && (
        <>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="w-10 text-xs text-muted-foreground shrink-0">{t('died')}</span>
            <span className="font-medium">
              <EditableField field="deathDate" value={fullPerson.deathDate ?? ''} editState={editState} label={tFields('deathDate')} />
            </span>
          </div>
          <div className="ml-12">
            <EditableField field="deathPlace" value={fullPerson.deathPlace ?? ''} editState={editState} label={tFields('deathPlace')} />
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
  const t = useTranslations('tree.detail.notes');
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
          placeholder={t('placeholder')}
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
          {t('addPrompt')}
        </button>
      </div>
    );
  }

  if (!text) return null;

  const isLong = text.length > 150;

  return (
    <div className="border-b p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">{t('heading')}</div>
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
          {t('more')}
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
  const router = useRouter();
  const { person: fullPerson, events, citationCount, isLoading, refresh } = usePersonDetail(person.id);
  const editState = useInlineEdit(person.id, refresh);
  const [dialog, setDialog] = useState<{
    kind: 'create' | 'link';
    relation: RelationType;
  } | null>(null);
  // null = closed; { event: undefined } = create; { event: <ev> } = edit
  const [eventDialog, setEventDialog] = useState<{ event?: PersonEvent } | null>(null);

  const handleAddRelation = useCallback((kind: 'create' | 'link', relation: RelationType) => {
    setDialog({ kind, relation });
  }, []);

  const fullName = `${person.givenName} ${person.surname}`;
  const personSex = (fullPerson?.sex ?? person.sex) as 'M' | 'F' | 'U';

  const handleAfterMutation = useCallback(() => {
    personDetailCache.invalidate(person.id);
    router.refresh();
    setDialog(null);
  }, [person.id, router]);

  // Triggered by inline remove buttons in DetailFamily / DetailTimeline.
  const handleAfterRemoval = useCallback(() => {
    personDetailCache.invalidate(person.id);
    refresh();
    router.refresh();
  }, [person.id, refresh, router]);

  const handleAfterEvent = useCallback(() => {
    personDetailCache.invalidate(person.id);
    refresh();
    router.refresh();
    setEventDialog(null);
  }, [person.id, refresh, router]);

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
      <DetailFamily
        person={person}
        treeData={treeData}
        onFocusNode={onFocusNode}
        editMode={editState.isEditMode}
        onAddRelation={handleAddRelation}
        onMutated={handleAfterRemoval}
      />
      <DetailTimeline
        events={events}
        person={person}
        isLoading={isLoading}
        editMode={editState.isEditMode}
        onAddEvent={() => setEventDialog({})}
        onEditEvent={(ev) => setEventDialog({ event: ev })}
        onMutated={handleAfterRemoval}
      />
      <DetailNotes notes={fullPerson?.notes} isLoading={isLoading} editState={editState} />
      <DetailSources personId={person.id} citationCount={citationCount} isLoading={isLoading} />

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

      {eventDialog && (
        <EventCreateDialog
          open
          onOpenChange={(open) => { if (!open) setEventDialog(null); }}
          personId={person.id}
          personName={fullName}
          event={eventDialog.event}
          onSaved={handleAfterEvent}
        />
      )}
    </div>
  );
}
