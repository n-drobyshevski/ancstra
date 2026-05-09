'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePersonsFilters, useFilterUpdate } from './use-persons-filters';

interface Chip {
  key: string;
  label: string;
  remove: () => void;
}

export function ActiveFilters() {
  const t = useTranslations('persons.activeFilters');
  const tSex = useTranslations('persons.facets.sex.values');
  const tLiving = useTranslations('persons.facets.living.values');
  const tValidation = useTranslations('persons.table.validation');
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();

  const chips: Chip[] = [];

  if (filters.q.trim()) {
    chips.push({
      key: 'q',
      label: t('search', { value: filters.q.trim() }),
      remove: () => update({ q: '' }),
    });
  }
  if (filters.sex.length > 0 && filters.sex.length < 3) {
    chips.push({
      key: 'sex',
      label: t('sex', { values: filters.sex.map((s) => tSex(s)).join(', ') }),
      remove: () => update({ sex: [] }),
    });
  }
  if (filters.living.length === 1) {
    chips.push({
      key: 'living',
      label: t('living', { value: tLiving(filters.living[0]) }),
      remove: () => update({ living: [] }),
    });
  }
  if (filters.validation.length === 1) {
    chips.push({
      key: 'validation',
      label: t('validation', { value: tValidation(filters.validation[0]) }),
      remove: () => update({ validation: [] }),
    });
  }
  if (filters.bornFrom !== null || filters.bornTo !== null) {
    chips.push({
      key: 'born',
      label: t('born', {
        from: filters.bornFrom ?? t('openEllipsis'),
        to: filters.bornTo ?? t('openEllipsis'),
      }),
      remove: () => update({ bornFrom: null, bornTo: null }),
    });
  }
  if (filters.diedFrom !== null || filters.diedTo !== null) {
    chips.push({
      key: 'died',
      label: t('died', {
        from: filters.diedFrom ?? t('openEllipsis'),
        to: filters.diedTo ?? t('openEllipsis'),
      }),
      remove: () => update({ diedFrom: null, diedTo: null }),
    });
  }
  if (filters.place.trim()) {
    chips.push({
      key: 'place',
      label: t('place', {
        value: filters.place.trim(),
        scope: filters.placeScope === 'birth' ? t('placeScopeBirth') : t('placeScopeAny'),
      }),
      remove: () => update({ place: '', placeScope: 'birth' }),
    });
  }
  if (filters.citations !== 'any') {
    const citationsKey =
      filters.citations === 'none'
        ? 'citationsNone'
        : filters.citations === 'gte1'
          ? 'citationsGte1'
          : 'citationsGte3';
    chips.push({
      key: 'citations',
      label: t(citationsKey),
      remove: () => update({ citations: 'any' }),
    });
  }
  if (filters.complGte !== null) {
    chips.push({
      key: 'compl',
      label: t('completeness', { value: filters.complGte }),
      remove: () => update({ complGte: null }),
    });
  }
  if (filters.hasProposals) {
    chips.push({
      key: 'proposals',
      label: t('hasProposals'),
      remove: () => update({ hasProposals: false }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1" role="region" aria-label={t('ariaLabel')}>
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="pl-2 pr-1 gap-1">
          <span className="text-xs">{chip.label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-background"
            aria-label={t('removeChipAriaLabel', { label: chip.label })}
            onClick={chip.remove}
          >
            <X className="h-3 w-3" aria-hidden />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
