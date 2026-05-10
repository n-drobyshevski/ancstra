'use client';

import { useMemo, useState } from 'react';
import type { TreeData } from '@ancstra/shared';
import { useTranslations } from 'next-intl';
import { Highlighter, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  collectSurnameOptions,
  normalizeSurname,
} from '@/lib/tree/surname-highlight';
import type { SurnameHighlightStyle } from '@/lib/tree/view-prefs-storage';

interface TreeSurnameHighlightPopoverProps {
  treeData: TreeData;
  /** Currently active surname (lowercase). `null` when feature is off. */
  activeSurname: string | null;
  onChangeSurname: (surname: string | null) => void;
  highlightStyle: SurnameHighlightStyle;
  onChangeHighlightStyle: (s: SurnameHighlightStyle) => void;
}

/**
 * Toolbar entry point for the surname-branch highlight feature. Opens a
 * Command-palette-style picker so users can search/select a surname; the
 * footer toggles overlay vs replace style and exposes a clear button.
 */
export function TreeSurnameHighlightPopover({
  treeData,
  activeSurname,
  onChangeSurname,
  highlightStyle,
  onChangeHighlightStyle,
}: TreeSurnameHighlightPopoverProps) {
  const t = useTranslations('tree.toolbar.surnameHighlight');
  const [open, setOpen] = useState(false);

  const options = useMemo(() => collectSurnameOptions(treeData), [treeData]);

  // Display label for the active surname uses the most-frequent casing.
  const activeOption = activeSurname
    ? options.find((o) => o.value === activeSurname)
    : null;
  const isActive = !!activeSurname;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? 'default' : 'secondary'}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          aria-label={t('triggerLabel')}
        >
          <Highlighter className="size-3.5" aria-hidden />
          {activeOption ? (
            <span className="font-medium">{activeOption.label}</span>
          ) : (
            <span>{t('triggerEmpty')}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[20rem] p-0">
        <Command>
          <CommandInput placeholder={t('searchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('emptyResults')}</CommandEmpty>
            <CommandGroup heading={t('groupHeading', { count: options.length })}>
              {options.map((opt) => {
                const selected = activeSurname === opt.value;
                return (
                  <CommandItem
                    key={opt.value}
                    // cmdk filters by `value`. Use the lowercase value so
                    // typing in any casing matches; the label is rendered
                    // separately so original casing still displays.
                    value={`${opt.label} ${opt.value}`}
                    onSelect={() => {
                      onChangeSurname(selected ? null : opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'size-3.5',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{opt.label}</span>
                    <span className="text-muted-foreground tabular-nums text-[11px]">
                      {opt.count}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <div className="flex flex-col gap-1.5 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {t('applyAsLabel')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px]"
                disabled={!isActive}
                onClick={() => {
                  onChangeSurname(null);
                  setOpen(false);
                }}
              >
                <X className="size-3" aria-hidden />
                {t('clear')}
              </Button>
            </div>
            <div className="flex w-full rounded-md border border-border p-0.5">
              <button
                type="button"
                className={cn(
                  'flex-1 rounded px-2 py-1 text-[11px] transition-colors',
                  highlightStyle === 'overlay'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => onChangeHighlightStyle('overlay')}
              >
                {t('applyAsOverlay')}
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 rounded px-2 py-1 text-[11px] transition-colors',
                  highlightStyle === 'replace'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => onChangeHighlightStyle('replace')}
              >
                {t('applyAsReplace')}
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 rounded px-2 py-1 text-[11px] transition-colors',
                  highlightStyle === 'fadeOut'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => onChangeHighlightStyle('fadeOut')}
              >
                {t('applyAsFadeOut')}
              </button>
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Helper exported for callers that need to normalize an input surname
 *  before passing it through to the popover. */
export { normalizeSurname };
