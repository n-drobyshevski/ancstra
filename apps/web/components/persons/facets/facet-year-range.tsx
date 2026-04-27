'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { FacetBlock } from './facet-block';
import { usePersonsFilters, useFilterUpdate } from '../use-persons-filters';
import type { PersonsFilters } from '@/lib/persons/search-params';

interface FacetYearRangeProps {
  label: string;
  fromKey: 'bornFrom' | 'diedFrom';
  toKey: 'bornTo' | 'diedTo';
  defaultOpen?: boolean;
  visualBounds: { minYear: number; maxYear: number };
}

export function FacetYearRange({
  label, fromKey, toKey, defaultOpen = false, visualBounds,
}: FacetYearRangeProps) {
  const { filters } = usePersonsFilters();
  const update = useFilterUpdate();

  const fromUrl = filters[fromKey] as number | null;
  const toUrl = filters[toKey] as number | null;

  const [fromText, setFromText] = useState<string>(fromUrl?.toString() ?? '');
  const [toText, setToText] = useState<string>(toUrl?.toString() ?? '');

  useEffect(() => { setFromText(fromUrl?.toString() ?? ''); }, [fromUrl]);
  useEffect(() => { setToText(toUrl?.toString() ?? ''); }, [toUrl]);

  const active = fromUrl !== null || toUrl !== null;

  const sliderValue: [number, number] = [
    fromUrl ?? visualBounds.minYear,
    toUrl ?? visualBounds.maxYear,
  ];

  const commitInput = (which: 'from' | 'to', text: string) => {
    const trimmed = text.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    const value = Number.isNaN(parsed as number) ? null : parsed;
    if (which === 'from') {
      update({ [fromKey]: value } as Partial<PersonsFilters>);
    } else {
      update({ [toKey]: value } as Partial<PersonsFilters>);
    }
  };

  return (
    <FacetBlock label={label} defaultOpen={defaultOpen} active={active}>
      <Slider
        min={visualBounds.minYear}
        max={visualBounds.maxYear}
        step={1}
        value={sliderValue}
        onValueChange={([from, to]) => {
          update({
            [fromKey]: from === visualBounds.minYear ? null : from,
            [toKey]: to === visualBounds.maxYear ? null : to,
          } as Partial<PersonsFilters>);
        }}
        aria-label={`${label} year range`}
      />
      <div className="flex items-center gap-2 mt-2">
        <Input
          type="number"
          inputMode="numeric"
          aria-label={`${label} from year`}
          placeholder="From"
          value={fromText}
          onChange={(e) => setFromText(e.target.value)}
          onBlur={(e) => commitInput('from', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitInput('from', e.currentTarget.value); }}
          className="h-8 text-sm tabular-nums"
        />
        <span className="text-muted-foreground" aria-hidden>–</span>
        <Input
          type="number"
          inputMode="numeric"
          aria-label={`${label} to year`}
          placeholder="To"
          value={toText}
          onChange={(e) => setToText(e.target.value)}
          onBlur={(e) => commitInput('to', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitInput('to', e.currentTarget.value); }}
          className="h-8 text-sm tabular-nums"
        />
      </div>
    </FacetBlock>
  );
}
