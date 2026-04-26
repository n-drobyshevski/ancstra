'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import {
  createFactsheet,
  type Factsheet,
} from '@/lib/research/factsheet-client';

type EntityType = 'person' | 'couple' | 'family_unit';
type Intent = 'draft' | 'research';

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'person', label: 'Person' },
  { value: 'couple', label: 'Couple' },
  { value: 'family_unit', label: 'Family' },
];

interface NewFactsheetFormProps {
  onCancel: () => void;
  onSavedDraft: (factsheet: Factsheet) => void;
  onSavedResearch: (title: string) => void;
}

export function NewFactsheetForm({
  onCancel,
  onSavedDraft,
  onSavedResearch,
}: NewFactsheetFormProps) {
  const [title, setTitle] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('person');
  const [notes, setNotes] = useState('');
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);

  const trimmedTitle = title.trim();
  const saving = savingIntent !== null;
  const canSubmit = trimmedTitle.length > 0 && !saving;
  const draftStatus = FACTSHEET_STATUS_CONFIG.draft;

  async function submit(intent: Intent) {
    if (!canSubmit) return;
    setSavingIntent(intent);
    try {
      const created = await createFactsheet({
        title: trimmedTitle,
        entityType,
        notes: notes.trim() || undefined,
      });
      if (intent === 'research') {
        toast.success('Factsheet created — opening research');
        onSavedResearch(trimmedTitle);
      } else {
        toast.success('Factsheet created');
        onSavedDraft(created);
      }
      // Reset state in case the parent keeps this component mounted after
      // the navigation (so a fresh re-open doesn't show stale data).
      setTitle('');
      setNotes('');
      setEntityType('person');
      setSavingIntent(null);
    } catch {
      toast.error('Failed to create factsheet');
      setSavingIntent(null);
    }
  }

  return (
    <>
      <form
        id="new-factsheet-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit('draft');
        }}
        className="p-4 space-y-5"
      >
        {/* Header — mirrors FactsheetDetail header (title + status pill) */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Factsheet</h2>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              draftStatus.className,
            )}
          >
            {draftStatus.label}
          </span>
        </div>

        {/* Title — boxed section mirroring FactsheetDetail's notes treatment */}
        <div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <label
              htmlFor="title"
              className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1"
            >
              Title <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              name="title"
              autoFocus
              required
              aria-required="true"
              placeholder="e.g. John Smith, b. 1880, Boston"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            A working title for this hypothesis. You can refine it later.
          </p>
        </div>

        {/* Entity type — boxed section with segmented control inside */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Type
          </label>
          <div
            role="radiogroup"
            aria-label="Entity type"
            className="inline-flex w-full overflow-hidden rounded-md border border-border bg-background md:w-auto"
          >
            {ENTITY_OPTIONS.map((opt) => {
              const isActive = entityType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setEntityType(opt.value)}
                  className={`flex-1 px-4 py-1.5 text-sm font-medium transition-colors md:flex-none ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes — boxed section mirroring FactsheetDetail's notes treatment */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <label
            htmlFor="notes"
            className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1"
          >
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Anything you already know — locations, dates, sources, leads..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Facts — ghost preview of FactsheetDetail's Facts section, available after saving */}
        <div
          className="rounded-lg border border-dashed border-border bg-muted/20 p-3"
          aria-hidden="true"
        >
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Facts
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              after saving
            </span>
          </div>
          <p className="text-xs text-muted-foreground/80">
            Add facts once the factsheet is saved as a draft.
          </p>
        </div>

        {/* Links — ghost preview of FactsheetDetail's Links section, available after saving */}
        <div
          className="rounded-lg border border-dashed border-border bg-muted/20 p-3"
          aria-hidden="true"
        >
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Links
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              after saving
            </span>
          </div>
          <p className="text-xs text-muted-foreground/80">
            Link people, places, sources, and other factsheets.
          </p>
        </div>

        {/* Desktop: inline buttons */}
        <div className="hidden items-center justify-end gap-2 md:flex">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit}
            onClick={() => submit('draft')}
          >
            {savingIntent === 'draft' ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit}
            onClick={() => submit('research')}
            className="text-green-600 border-green-600/30 hover:bg-green-600/10 hover:text-green-700"
          >
            {savingIntent === 'research'
              ? 'Saving...'
              : 'Save & Start Research'}
          </Button>
        </div>
      </form>

      {/* Mobile: sticky bottom action bar — primary on top, secondary below */}
      <div className="fixed inset-x-0 bottom-0 z-50 space-y-2 border-t border-border bg-background px-4 pb-[env(safe-area-inset-bottom,0px)] pt-2 shadow-lg md:hidden">
        <Button
          type="button"
          variant="outline"
          disabled={!canSubmit}
          className="h-11 w-full text-green-600 border-green-600/30 hover:bg-green-600/10 hover:text-green-700"
          onClick={() => submit('research')}
        >
          {savingIntent === 'research'
            ? 'Saving...'
            : 'Save & Start Research'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canSubmit}
          className="h-11 w-full"
          onClick={() => submit('draft')}
        >
          {savingIntent === 'draft' ? 'Saving...' : 'Save Draft'}
        </Button>
      </div>
    </>
  );
}
