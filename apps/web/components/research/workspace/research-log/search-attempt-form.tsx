'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  SEARCH_PROVIDER_KINDS,
  SEARCH_OUTCOMES,
  SEARCH_OUTCOMES_REQUIRING_NOTES,
  type SearchProviderKind,
  type SearchOutcome,
} from '@ancstra/db/vocab';
import { useSearchAttemptMutations } from '@/hooks/use-search-attempt-mutations';
import type { SearchAttempt } from '@/hooks/use-search-attempts';

/**
 * Bundle E 2026-05-26 — SearchAttemptForm
 *
 * Single form reused for create and edit. React Hook Form + Zod not used here
 * — the form manages its own state with useState + a manual Zod-equivalent
 * client-side guard (mirrors the server-side superRefine / assertNotesRule).
 *
 * Key behaviours:
 *  - Conditional providerLabel field (shown only for ad-hoc kinds: archive, library, family, other)
 *  - Conditional notes-required indicator (red asterisk + hint) when outcome ∈ {negative, inconclusive}
 *  - Client-side guard prevents submit when notes required but empty
 *  - Edit mode pre-populates all fields from initialValue
 *  - Calls POST /api/persons/[id]/search-attempts (create) or PATCH /api/search-attempts/[id] (edit)
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.3.
 */

/** Provider kinds that require a free-text providerLabel (ad-hoc / not an online platform). */
const AD_HOC_KINDS: readonly SearchProviderKind[] = ['archive', 'library', 'family', 'other'];

export interface SearchAttemptFormProps {
  mode: 'create' | 'edit';
  personId: string;
  initialValue?: SearchAttempt;
  /** Called with the server-returned attempt on successful save. */
  onSubmitted: (attempt: SearchAttempt) => void;
  onCancel: () => void;
  /** Optional list of research threads for the threadId combobox (future). */
  threads?: Array<{ id: string; title: string }>;
}

function roundedNow(): string {
  const d = new Date();
  const ms = 5 * 60 * 1000;
  return new Date(Math.round(d.getTime() / ms) * ms).toISOString().slice(0, 16);
}

function outcomeRequiresNotes(o: SearchOutcome): boolean {
  return (SEARCH_OUTCOMES_REQUIRING_NOTES as readonly string[]).includes(o);
}

export function SearchAttemptForm({
  mode,
  personId,
  initialValue,
  onSubmitted,
  onCancel,
}: SearchAttemptFormProps) {
  const t = useTranslations('persons.researchLog');
  const { create, update, isCreating, isUpdating } = useSearchAttemptMutations(personId);
  const isSubmitting = isCreating || isUpdating;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [providerKind, setProviderKind] = useState<SearchProviderKind>(
    (initialValue?.providerKind as SearchProviderKind) ?? 'familysearch',
  );
  const [providerLabel, setProviderLabel] = useState<string>(initialValue?.providerLabel ?? '');
  const [query, setQuery] = useState<string>(initialValue?.query ?? '');
  const [outcome, setOutcome] = useState<SearchOutcome>(
    (initialValue?.outcome as SearchOutcome) ?? 'found',
  );
  const [notes, setNotes] = useState<string>(initialValue?.notes ?? '');
  const [searchedAt, setSearchedAt] = useState<string>(
    initialValue
      ? new Date(initialValue.searchedAt).toISOString().slice(0, 16)
      : roundedNow(),
  );

  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Derived state ────────────────────────────────────────────────────────────
  const showProviderLabel = AD_HOC_KINDS.includes(providerKind);
  const notesRequired = outcomeRequiresNotes(outcome);
  const notesEmpty = notes.trim().length === 0;
  const clientBlocked = notesRequired && notesEmpty;

  // ── Submit handler ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    if (clientBlocked) {
      setFieldErrors({ notes: t('form.notesRequiredHint') });
      return;
    }

    const payload = {
      providerKind,
      providerLabel: showProviderLabel && providerLabel.trim().length > 0
        ? providerLabel.trim() : null,
      query: query.trim().length > 0 ? query.trim() : null,
      outcome,
      notes: notes.trim().length > 0 ? notes : null,
      searchedAt: new Date(searchedAt).toISOString(),
    };

    const result = mode === 'create'
      ? await create(payload)
      : await update({ attemptId: initialValue!.id, patch: payload });

    if (result.error) {
      setServerError(result.error.message);
      if (result.error.fields) setFieldErrors(result.error.fields);
      return;
    }
    if (result.data) onSubmitted(result.data);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Provider kind */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sa-providerKind">{t('form.providerKindLabel')}</Label>
        <Select
          value={providerKind}
          onValueChange={(v) => setProviderKind(v as SearchProviderKind)}
        >
          <SelectTrigger
            id="sa-providerKind"
            aria-label={t('form.providerKindLabel')}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEARCH_PROVIDER_KINDS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`providers.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Provider label — only for ad-hoc kinds */}
      {showProviderLabel && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sa-providerLabel">{t('form.providerLabelLabel')}</Label>
          <Input
            id="sa-providerLabel"
            value={providerLabel}
            onChange={(e) => setProviderLabel(e.target.value)}
            maxLength={200}
            placeholder={t('form.providerLabelPlaceholder')}
          />
        </div>
      )}

      {/* Query */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sa-query">{t('form.queryLabel')}</Label>
        <Input
          id="sa-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={1000}
          placeholder={t('form.queryPlaceholder')}
        />
      </div>

      {/* Searched at */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sa-searchedAt">{t('form.searchedAtLabel')}</Label>
        <Input
          id="sa-searchedAt"
          type="datetime-local"
          value={searchedAt}
          onChange={(e) => setSearchedAt(e.target.value)}
        />
      </div>

      {/* Outcome */}
      <div className="flex flex-col gap-2">
        <Label>{t('form.outcomeLabel')}</Label>
        <RadioGroup
          value={outcome}
          onValueChange={(v) => setOutcome(v as SearchOutcome)}
          className="flex flex-col gap-1.5"
        >
          {SEARCH_OUTCOMES.map((o) => (
            <div key={o} className="flex items-center gap-2">
              <RadioGroupItem value={o} id={`sa-outcome-${o}`} />
              <Label htmlFor={`sa-outcome-${o}`} className="cursor-pointer font-normal">
                {t(`outcomes.${o}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sa-notes" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {t('form.notesLabel')}
          {notesRequired && (
            <span aria-hidden data-testid="notes-required-marker" className="ml-0.5 text-destructive">*</span>
          )}
        </label>
        <Textarea
          id="sa-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          aria-required={notesRequired}
          rows={3}
        />
        {notesRequired && (
          <p className="text-xs text-muted-foreground">{t('form.notesRequiredHint')}</p>
        )}
        {fieldErrors.notes && (
          <p className="text-xs text-destructive">{fieldErrors.notes}</p>
        )}
      </div>

      {/* Server-level error */}
      {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('form.cancelLabel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {t('form.submitLabel')}
        </Button>
      </div>
    </form>
  );
}
