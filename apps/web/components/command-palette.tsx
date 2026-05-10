'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useViewport } from '@/hooks/use-viewport';
import type { PersonListItem } from '@ancstra/shared';
import { personDetailCache } from '@/lib/tree/person-detail-cache';

type ActionKey =
  | 'addPerson'
  | 'importGedcom'
  | 'exportGedcom'
  | 'goToTree'
  | 'goToPeople'
  | 'goToDashboard';

interface ActionDef {
  key: ActionKey;
  href: string;
  keywords: string[];
}

const actions: ActionDef[] = [
  { key: 'addPerson', href: '/persons/new', keywords: ['add', 'create', 'new', 'person'] },
  { key: 'importGedcom', href: '/data', keywords: ['import', 'gedcom', 'upload'] },
  { key: 'exportGedcom', href: '/data?tab=export', keywords: ['export', 'gedcom', 'download'] },
  { key: 'goToTree', href: '/tree', keywords: ['tree', 'canvas', 'visualization'] },
  { key: 'goToPeople', href: '/persons', keywords: ['people', 'persons', 'list'] },
  { key: 'goToDashboard', href: '/dashboard', keywords: ['dashboard', 'home'] },
];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common.commandPalette');
  const tActions = useTranslations('common.commandPalette.actions');
  const tSex = useTranslations('common.sexLabels');
  const { isMobile } = useViewport();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonListItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Debounced FTS5 search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=8`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.persons ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      setResults([]);
      // If selecting a person while on tree page, focus instead of navigating away
      if (href.startsWith('/persons/') && pathname === '/tree') {
        const personId = href.replace('/persons/', '');
        router.push(`/tree?focus=${personId}`);
      } else {
        router.push(href);
      }
    },
    [router, pathname],
  );

  // Filter actions client-side. Match against the (translated) label and the
  // English keyword set so legacy keyword muscle-memory still works in any
  // locale.
  const filteredActions = query.trim()
    ? actions.filter((a) => {
        const q = query.toLowerCase();
        const label = tActions(a.key).toLowerCase();
        return label.includes(q) || a.keywords.some((k) => k.includes(q));
      })
    : actions;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      // Below md, override the default centered/clipped dialog with a
      // fullscreen sheet so the on-screen keyboard never covers results and
      // the focused input has the whole viewport. Desktop keeps the centered
      // top-1/3 placement defined in components/ui/command.tsx.
      className={
        isMobile
          ? 'top-0 left-0 right-0 bottom-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none! border-0'
          : undefined
      }
      showCloseButton={isMobile}
    >
      <CommandInput
        placeholder={t('placeholder')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className={isMobile ? 'flex-1 max-h-none' : undefined}>
        <CommandEmpty>
          {searching ? t('searching') : t('noResults')}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading={t('groupPeople')}>
            {results.map((person) => (
              <CommandItem
                key={person.id}
                value={`person-${person.id}`}
                onSelect={() => handleSelect(`/persons/${person.id}`)}
                onPointerEnter={() => { void personDetailCache.prefetch(person.id); }}
                onFocus={() => { void personDetailCache.prefetch(person.id); }}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium">
                    {person.givenName} {person.surname}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {tSex(person.sex)}
                  </Badge>
                  {person.birthDate && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {t('birthPrefix', { date: person.birthDate })}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading={t('groupActions')}>
          {filteredActions.map((action) => (
            <CommandItem
              key={action.href}
              value={tActions(action.key)}
              onSelect={() => handleSelect(action.href)}
            >
              {tActions(action.key)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
