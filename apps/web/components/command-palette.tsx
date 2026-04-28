'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import type { PersonListItem } from '@ancstra/shared';
import { personDetailCache } from '@/lib/tree/person-detail-cache';

const actions = [
  { label: 'Add New Person', href: '/persons/new', keywords: ['add', 'create', 'new', 'person'] },
  { label: 'Import GEDCOM', href: '/data', keywords: ['import', 'gedcom', 'upload'] },
  { label: 'Export GEDCOM', href: '/data?tab=export', keywords: ['export', 'gedcom', 'download'] },
  { label: 'Go to Tree', href: '/tree', keywords: ['tree', 'canvas', 'visualization'] },
  { label: 'Go to People', href: '/persons', keywords: ['people', 'persons', 'list'] },
  { label: 'Go to Dashboard', href: '/dashboard', keywords: ['dashboard', 'home'] },
];

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
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

  // Filter actions client-side
  const filteredActions = query.trim()
    ? actions.filter((a) => {
        const q = query.toLowerCase();
        return (
          a.label.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.includes(q))
        );
      })
    : actions;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search people or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? 'Searching...' : 'No results found.'}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="People">
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
                    {sexLabel[person.sex]}
                  </Badge>
                  {person.birthDate && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      b. {person.birthDate}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Actions">
          {filteredActions.map((action) => (
            <CommandItem
              key={action.href}
              value={action.label}
              onSelect={() => handleSelect(action.href)}
            >
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
