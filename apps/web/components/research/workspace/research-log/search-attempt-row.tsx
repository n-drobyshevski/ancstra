'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ProviderChip } from './provider-chip';
import { OutcomeChip } from './outcome-chip';
import type { SearchAttempt } from '@/hooks/use-search-attempts';
import type { SearchProviderKind, SearchOutcome } from '@ancstra/db/vocab';

interface SearchAttemptRowProps {
  attempt: SearchAttempt;
  onEdit: (a: SearchAttempt) => void;
  onDelete: (a: SearchAttempt) => void;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Bundle E 2026-05-26 — a single row in the SearchAttemptList.
 *
 * Displays: OutcomeChip + ProviderChip + date + truncated query + truncated notes.
 * Hover reveals edit/delete action buttons. Clicking the row (excluding action
 * buttons) invokes onEdit so the parent can open the edit form.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.5.
 */
export function SearchAttemptRow({ attempt, onEdit, onDelete }: SearchAttemptRowProps) {
  const t = useTranslations('persons.researchLog');
  return (
    <li
      role="listitem"
      className="group flex flex-col gap-1 rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted/50 cursor-pointer"
      onClick={() => onEdit(attempt)}
    >
      <div className="flex items-center gap-2">
        <OutcomeChip outcome={attempt.outcome as SearchOutcome} />
        <ProviderChip
          providerKind={attempt.providerKind as SearchProviderKind}
          providerLabel={attempt.providerLabel}
        />
        <span className="text-xs text-muted-foreground">
          {formatDate(attempt.searchedAt)}
        </span>
        <div className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('editAction')}
            onClick={(e) => { e.stopPropagation(); onEdit(attempt); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('deleteAction')}
            onClick={(e) => { e.stopPropagation(); onDelete(attempt); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {attempt.query && (
        <p className="text-sm font-medium text-foreground">{truncate(attempt.query, 50)}</p>
      )}
      {attempt.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{truncate(attempt.notes, 80)}</p>
      )}
    </li>
  );
}
