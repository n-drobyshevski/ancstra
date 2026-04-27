'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart,
  Users,
  Baby,
  Link2,
  Search,
  UserPlus,
  Loader2,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PersonListItem } from '@ancstra/shared';

import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export type RelationType = 'spouse' | 'father' | 'mother' | 'child';

interface PersonLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personId: string;
  personName: string;
  personSex: 'M' | 'F' | 'U';
  relationType: RelationType;
  onLinked?: () => void;
}

const RELATION_CONFIG: Record<
  RelationType,
  { icon: typeof Heart; label: string; description: string; sexFilter?: 'M' | 'F' }
> = {
  spouse: {
    icon: Heart,
    label: 'Spouse',
    description: 'Link an existing person as spouse',
  },
  father: {
    icon: Users,
    label: 'Father',
    description: 'Link an existing person as father',
    sexFilter: 'M',
  },
  mother: {
    icon: Users,
    label: 'Mother',
    description: 'Link an existing person as mother',
    sexFilter: 'F',
  },
  child: {
    icon: Baby,
    label: 'Child',
    description: 'Link an existing person as child',
  },
};

function getInitials(givenName: string, surname: string): string {
  const first = givenName.charAt(0).toUpperCase();
  const last = surname.charAt(0).toUpperCase();
  return `${first}${last}`.trim() || '?';
}

export function PersonLinkDialog({
  open,
  onOpenChange,
  personId,
  personName,
  personSex,
  relationType,
  onLinked,
}: PersonLinkDialogProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selected, setSelected] = useState<PersonListItem | null>(null);

  const config = RELATION_CONFIG[relationType];

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelected(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q: query,
          size: '20',
        });
        const res = await fetch(`/api/persons?${params}`);
        if (res.ok) {
          const data = await res.json();
          let filtered = data.items.filter(
            (p: PersonListItem) => p.id !== personId,
          );
          // Client-side sex filter for father/mother
          if (config.sexFilter) {
            filtered = filtered.filter(
              (p: PersonListItem) => p.sex === config.sexFilter || p.sex === 'U',
            );
          }
          setResults(filtered.slice(0, 8));
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, personId, config.sexFilter]);

  const handleLink = useCallback(async () => {
    if (!selected) return;
    setLinking(true);
    try {
      if (relationType === 'spouse') {
        const res = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner1Id: personId,
            partner2Id: selected.id,
          }),
        });
        if (!res.ok) {
          toast.error('Failed to link spouse');
          return;
        }
      } else if (relationType === 'father' || relationType === 'mother') {
        const partnerKey =
          relationType === 'father' ? 'partner1Id' : 'partner2Id';
        const famRes = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [partnerKey]: selected.id }),
        });
        if (!famRes.ok) {
          toast.error('Failed to create family');
          return;
        }
        const family = await famRes.json();
        const childRes = await fetch(`/api/families/${family.id}/children`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId }),
        });
        if (!childRes.ok) {
          toast.error('Failed to link as child');
          return;
        }
      } else if (relationType === 'child') {
        const partnerKey = personSex === 'F' ? 'partner2Id' : 'partner1Id';
        const famRes = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [partnerKey]: personId }),
        });
        if (!famRes.ok) {
          toast.error('Failed to create family');
          return;
        }
        const family = await famRes.json();
        const childRes = await fetch(`/api/families/${family.id}/children`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: selected.id }),
        });
        if (!childRes.ok) {
          toast.error('Failed to link child');
          return;
        }
      }

      toast.success(
        `Linked ${selected.givenName} ${selected.surname} as ${config.label.toLowerCase()}`,
      );
      onOpenChange(false);
      onLinked?.();
    } catch {
      toast.error('Network error');
    } finally {
      setLinking(false);
    }
  }, [selected, relationType, personId, personSex, config.label, onOpenChange, onLinked]);

  const newPersonHref = relationType === 'father' || relationType === 'mother'
    ? `/persons/new?relation=${relationType}&of=${personId}`
    : relationType === 'child'
      ? `/persons/new?relation=child&of=${personId}`
      : `/persons/new?relation=spouse&of=${personId}`;

  const content = (
    <div className="flex flex-col">
      {/* Confirmation view */}
      {selected ? (
        <div className="p-4 space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Confirm relationship
            </p>

            {/* Visual relationship preview — vertical stack */}
            <div className="flex flex-col gap-2">
              {/* Current person */}
              <div className="flex items-center gap-2.5 rounded-lg border bg-background p-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {personName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{personName}</p>
                  <p className="text-[10px] text-muted-foreground">Current person</p>
                </div>
              </div>

              {/* Vertical connector with relation label */}
              <div className="flex items-center gap-2 pl-6">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-medium text-primary shrink-0 px-1">
                  {config.label}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Selected person */}
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/[0.04] p-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {getInitials(selected.givenName, selected.surname)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {selected.givenName} {selected.surname}
                  </p>
                  {selected.birthDate && (
                    <p className="text-[10px] text-muted-foreground">
                      b. {selected.birthDate}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(null)}
              disabled={linking}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleLink}
              disabled={linking}
            >
              {linking ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link2 className="mr-1.5 size-3.5" />
                  Confirm Link
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Search view */
        <Command shouldFilter={false} className="rounded-xl!">
          <CommandInput
            placeholder={
              config.sexFilter
                ? `Search ${config.sexFilter === 'M' ? 'male' : 'female'} persons...`
                : 'Search persons by name...'
            }
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-64 md:max-h-72">
            {/* Loading state */}
            {searching && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            )}

            {/* Empty state */}
            {!searching && query.trim() && results.length === 0 && (
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-2">
                  <Search className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No matching persons found
                  </p>
                  <Link
                    href={newPersonHref}
                    onClick={() => onOpenChange(false)}
                  >
                    <Button variant="outline" size="sm" className="mt-1">
                      <UserPlus className="mr-1.5 size-3.5" />
                      Create new person
                    </Button>
                  </Link>
                </div>
              </CommandEmpty>
            )}

            {/* Results */}
            {!searching && results.length > 0 && (
              <CommandGroup>
                {results.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => setSelected(p)}
                    className="flex items-center gap-3 py-2.5 px-2 cursor-pointer"
                  >
                    {/* Avatar */}
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {getInitials(p.givenName, p.surname)}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {p.givenName} {p.surname}
                        </span>
                        {p.sex !== 'U' && (
                          <Badge
                            variant={p.sex === 'M' ? 'default' : 'secondary'}
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            {p.sex === 'M' ? 'Male' : 'Female'}
                          </Badge>
                        )}
                      </div>
                      {(p.birthDate || p.deathDate) && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <CalendarDays className="size-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {p.birthDate && `b. ${p.birthDate}`}
                            {p.birthDate && p.deathDate && ' – '}
                            {p.deathDate && `d. ${p.deathDate}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Prompt state */}
            {!searching && !query.trim() && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Search className="size-8 text-muted-foreground/30" />
                <p className="text-sm">
                  Type a name to search
                </p>
                {config.sexFilter && (
                  <p className="text-xs text-muted-foreground/70">
                    Filtered to {config.sexFilter === 'M' ? 'male' : 'female'} persons
                  </p>
                )}
              </div>
            )}
          </CommandList>
        </Command>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <config.icon className="size-4" />
              Link {config.label}
            </DrawerTitle>
            <DrawerDescription>
              {config.description}
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <config.icon className="size-4" />
            Link {config.label}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
