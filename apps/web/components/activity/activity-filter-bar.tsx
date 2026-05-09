'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Filter, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { ActivityVisibility } from '@/lib/activity-visibility';
import type { ActivityCategoryKey } from '@/lib/activity-config';

export type ActivityDatePreset = 'all' | '24h' | '7d' | '30d';
const DATE_PRESETS: ActivityDatePreset[] = ['all', '24h', '7d', '30d'];

export interface ActivityFilters {
  category: ActivityCategoryKey;
  userId: string;
  q: string;
  datePreset: ActivityDatePreset;
}

export interface ActivityFeedMember {
  userId: string;
  name: string | null;
  email: string;
}

interface ActivityFilterBarProps {
  visibility: ActivityVisibility;
  members: ActivityFeedMember[] | undefined;
  filters: ActivityFilters;
  onFiltersChange: (next: ActivityFilters) => void;
}

/**
 * Convert a date preset into ISO `since`/`until` strings consumed by the API.
 * Centralised here so server and client agree on the boundary semantics.
 */
export function rangeForPreset(
  preset: ActivityDatePreset,
): { since?: string; until?: string } {
  if (preset === 'all') return {};
  const now = Date.now();
  const offsets: Record<Exclude<ActivityDatePreset, 'all'>, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return { since: new Date(now - offsets[preset]).toISOString() };
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface SecondaryFiltersProps {
  members: ActivityFeedMember[] | undefined;
  filters: ActivityFilters;
  onFiltersChange: (next: ActivityFilters) => void;
  /** Visual layout: 'inline' for desktop, 'stacked' for the mobile Sheet. */
  layout: 'inline' | 'stacked';
}

function SecondaryFilters({
  members,
  filters,
  onFiltersChange,
  layout,
}: SecondaryFiltersProps) {
  const t = useTranslations('activity.filters');
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebounced(searchInput, 300);

  // Push debounced value up; skip the initial echo so we don't clobber the
  // controlled value when our prop changes externally.
  useEffect(() => {
    if (debouncedSearch === filters.q) return;
    onFiltersChange({ ...filters, q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Mirror external resets back into the local input (e.g. clear-all chip).
  useEffect(() => {
    if (filters.q !== searchInput) setSearchInput(filters.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const containerClass =
    layout === 'inline'
      ? 'flex flex-wrap items-center gap-2'
      : 'flex flex-col gap-3';

  const fieldClass = layout === 'inline' ? 'h-9' : 'h-10';

  return (
    <div className={containerClass}>
      <div className={layout === 'inline' ? 'relative' : 'relative w-full'}>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className={`${fieldClass} ${layout === 'inline' ? 'w-[200px]' : 'w-full'} pl-8`}
          aria-label={t('searchAriaLabel')}
        />
      </div>

      {members && members.length > 0 ? (
        <Select
          value={filters.userId}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, userId: v })
          }
        >
          <SelectTrigger
            size={layout === 'inline' ? 'sm' : 'default'}
            className={`${fieldClass} ${layout === 'inline' ? 'w-[180px]' : 'w-full'}`}
            aria-label={t('memberFilterAriaLabel')}
          >
            <SelectValue placeholder={t('byAnyone')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('byAnyone')}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {t('byMember', { name: m.name ?? m.email })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={layout === 'inline' ? 'sm' : 'default'}
            className={`${fieldClass} justify-start gap-2 ${layout === 'inline' ? '' : 'w-full'}`}
          >
            <CalendarRange className="size-4" />
            <span>{t('dateLabel', { value: t(`datePresets.${filters.datePreset}` as const) })}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1.5">
          <div role="radiogroup" aria-label={t('dateRangeAriaLabel')} className="flex flex-col">
            {DATE_PRESETS.map((preset) => {
              const active = filters.datePreset === preset;
              return (
                <Button
                  key={preset}
                  role="radio"
                  aria-checked={active}
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-start"
                  onClick={() =>
                    onFiltersChange({ ...filters, datePreset: preset })
                  }
                >
                  {t(`datePresets.${preset}` as const)}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ActiveChipsProps {
  filters: ActivityFilters;
  members: ActivityFeedMember[] | undefined;
  onClear: (key: 'q' | 'userId' | 'datePreset') => void;
}

function ActiveChips({ filters, members, onClear }: ActiveChipsProps) {
  const t = useTranslations('activity.filters');
  const chips: { key: 'q' | 'userId' | 'datePreset'; label: string }[] = [];
  if (filters.q.trim()) chips.push({ key: 'q', label: t('chipQuoted', { value: filters.q }) });
  if (filters.userId !== 'all') {
    const m = members?.find((m) => m.userId === filters.userId);
    chips.push({
      key: 'userId',
      label: t('byMember', { name: m?.name ?? m?.email ?? t('memberFallback') }),
    });
  }
  if (filters.datePreset !== 'all') {
    chips.push({ key: 'datePreset', label: t(`datePresets.${filters.datePreset}` as const) });
  }
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onClear(chip.key)}
          className="group inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground/80 ring-1 ring-foreground/10 hover:bg-muted/70 hover:text-foreground"
          aria-label={t('removeFilterAriaLabel', { label: chip.label })}
        >
          {chip.label}
          <X className="size-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}

export function ActivityFilterBar({
  visibility,
  members,
  filters,
  onFiltersChange,
}: ActivityFilterBarProps) {
  const tFilters = useTranslations('activity.filters');
  const tCategories = useTranslations('activity.categories');

  function clearChip(key: 'q' | 'userId' | 'datePreset') {
    if (key === 'q') onFiltersChange({ ...filters, q: '' });
    if (key === 'userId') onFiltersChange({ ...filters, userId: 'all' });
    if (key === 'datePreset') onFiltersChange({ ...filters, datePreset: 'all' });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tabs
          value={filters.category}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, category: v as ActivityCategoryKey })
          }
          className="min-w-0 flex-1"
        >
          <div className="-mx-3 overflow-x-auto scrollbar-none px-3 sm:mx-0 sm:px-0">
            <TabsList variant="line">
              {visibility.categories.map((cat) => (
                <TabsTrigger key={cat.key} value={cat.key}>
                  {tCategories(cat.key)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Mobile-only filter trigger (Sheet). Desktop renders the inline row below. */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 sm:hidden"
              aria-label={tFilters('moreFiltersAriaLabel')}
            >
              <Filter className="size-4" />
              {tFilters('moreFilters')}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{tFilters('sheetTitle')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <SecondaryFilters
                members={members}
                filters={filters}
                onFiltersChange={onFiltersChange}
                layout="stacked"
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop secondary filters */}
      <div className="hidden sm:block">
        <SecondaryFilters
          members={members}
          filters={filters}
          onFiltersChange={onFiltersChange}
          layout="inline"
        />
      </div>

      <ActiveChips filters={filters} members={members} onClear={clearChip} />
    </div>
  );
}
