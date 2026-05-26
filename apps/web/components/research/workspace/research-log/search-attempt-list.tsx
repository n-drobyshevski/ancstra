'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SEARCH_OUTCOMES, SEARCH_PROVIDER_KINDS } from '@ancstra/db/vocab';
import type { SearchProviderKind, SearchOutcome } from '@ancstra/db/vocab';
import type { SearchAttempt } from '@/hooks/use-search-attempts';
import { SearchAttemptRow } from './search-attempt-row';

interface SearchAttemptListProps {
  personId: string;
  items: SearchAttempt[];
  onEdit: (a: SearchAttempt) => void;
  onDelete: (a: SearchAttempt) => void;
}

const ALL = '__all__';

/**
 * Bundle E 2026-05-26 — chronological list of search attempts.
 *
 * Accepts server-sorted `items` (descending by searched_at) and applies
 * client-side filtering via two dropdowns: outcome and providerKind.
 * Empty state shown when `items` is empty (before filtering).
 *
 * TODO(Task 11): wire `isAddOpen` / `setIsAddOpen` to the real SearchAttemptForm
 * once Task 11 implements it.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.5.
 */
export function SearchAttemptList({ personId: _personId, items, onEdit, onDelete }: SearchAttemptListProps) {
  const t = useTranslations('persons.researchLog');
  const [outcomeFilter, setOutcomeFilter] = useState<string>(ALL);
  const [providerFilter, setProviderFilter] = useState<string>(ALL);
  // TODO(Task 11): open SearchAttemptForm dialog when true.
  const [, setIsAddOpen] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (outcomeFilter !== ALL && a.outcome !== outcomeFilter) return false;
      if (providerFilter !== ALL && a.providerKind !== providerFilter) return false;
      return true;
    });
  }, [items, outcomeFilter, providerFilter]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium">{t('emptyTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('emptyCta')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setIsAddOpen(true)}
        >
          {t('addButton')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="outcome-filter" className="text-xs text-muted-foreground">
            {t('filters.outcome')}
          </Label>
          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger id="outcome-filter" className="h-8 w-[140px] text-xs" aria-label="outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allOutcomes')}</SelectItem>
              {SEARCH_OUTCOMES.map((o) => (
                <SelectItem key={o} value={o}>
                  {t(`outcomes.${o}` as `outcomes.${SearchOutcome}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="provider-filter" className="text-xs text-muted-foreground">
            {t('filters.providerKind')}
          </Label>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger id="provider-filter" className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('filters.allProviders')}</SelectItem>
              {SEARCH_PROVIDER_KINDS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`providers.${p}` as `providers.${SearchProviderKind}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => setIsAddOpen(true)}
        >
          {t('addButton')}
        </Button>
      </div>

      {/* List */}
      <ul className="flex flex-col gap-2">
        {filtered.map((a) => (
          <SearchAttemptRow key={a.id} attempt={a} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </div>
  );
}
