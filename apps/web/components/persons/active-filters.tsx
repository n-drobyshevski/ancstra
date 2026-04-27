'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePersonsFilters, useFilterUpdate } from './use-persons-filters';

interface Chip {
  key: string;
  label: string;
  remove: () => void;
}

const SEX_LABELS = { M: 'Male', F: 'Female', U: 'Unknown' } as const;
const LIVING_LABELS = { alive: 'Alive', deceased: 'Deceased' } as const;
const VALIDATION_LABELS = { confirmed: 'Confirmed', proposed: 'Proposed' } as const;
const CITATIONS_LABELS = {
  any: '', none: 'No sources', gte1: '≥ 1 source', gte3: '≥ 3 sources',
} as const;

export function ActiveFilters() {
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();

  const chips: Chip[] = [];

  if (filters.q.trim()) {
    chips.push({ key: 'q', label: `Search: "${filters.q.trim()}"`, remove: () => update({ q: '' }) });
  }
  if (filters.sex.length > 0 && filters.sex.length < 3) {
    chips.push({
      key: 'sex',
      label: `Sex: ${filters.sex.map((s) => SEX_LABELS[s]).join(', ')}`,
      remove: () => update({ sex: [] }),
    });
  }
  if (filters.living.length === 1) {
    chips.push({
      key: 'living',
      label: `Living: ${LIVING_LABELS[filters.living[0]]}`,
      remove: () => update({ living: [] }),
    });
  }
  if (filters.validation.length === 1) {
    chips.push({
      key: 'validation',
      label: `Validation: ${VALIDATION_LABELS[filters.validation[0]]}`,
      remove: () => update({ validation: [] }),
    });
  }
  if (filters.bornFrom !== null || filters.bornTo !== null) {
    chips.push({
      key: 'born',
      label: `Born: ${filters.bornFrom ?? '…'}–${filters.bornTo ?? '…'}`,
      remove: () => update({ bornFrom: null, bornTo: null }),
    });
  }
  if (filters.diedFrom !== null || filters.diedTo !== null) {
    chips.push({
      key: 'died',
      label: `Died: ${filters.diedFrom ?? '…'}–${filters.diedTo ?? '…'}`,
      remove: () => update({ diedFrom: null, diedTo: null }),
    });
  }
  if (filters.place.trim()) {
    const scopeLabel = filters.placeScope === 'birth' ? '(birth)' : '(any)';
    chips.push({
      key: 'place',
      label: `Place: "${filters.place.trim()}" ${scopeLabel}`,
      remove: () => update({ place: '', placeScope: 'birth' }),
    });
  }
  if (filters.citations !== 'any') {
    chips.push({
      key: 'citations',
      label: CITATIONS_LABELS[filters.citations],
      remove: () => update({ citations: 'any' }),
    });
  }
  if (filters.complGte !== null) {
    chips.push({
      key: 'compl',
      label: `Completeness: ≥ ${filters.complGte}%`,
      remove: () => update({ complGte: null }),
    });
  }
  if (filters.hasProposals) {
    chips.push({
      key: 'proposals',
      label: 'AI proposals open',
      remove: () => update({ hasProposals: false }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1" role="region" aria-label="Active filters">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="pl-2 pr-1 gap-1">
          <span className="text-xs">{chip.label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-background"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={chip.remove}
          >
            <X className="h-3 w-3" aria-hidden />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
