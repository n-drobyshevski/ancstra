'use client';

import { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { PersonListItem } from '@ancstra/shared';

type RelationType = 'spouse' | 'father' | 'mother' | 'child';

interface PersonLinkPopoverProps {
  personId: string;
  personSex: 'M' | 'F' | 'U';
  onLinked?: () => void;
}

const sexBadgeVariant = {
  M: 'default',
  F: 'secondary',
  U: 'outline',
} as const;

export function PersonLinkPopover({
  personId,
  personSex,
  onLinked,
}: PersonLinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [relation, setRelation] = useState<RelationType>('spouse');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/persons?q=${encodeURIComponent(query)}&pageSize=5`,
        );
        if (res.ok) {
          const data = await res.json();
          setResults(
            data.items.filter((p: PersonListItem) => p.id !== personId),
          );
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, personId]);

  // Reset state when popover closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setRelation('spouse');
    }
  }, [open]);

  async function handleLink(selectedId: string) {
    setLinking(true);
    try {
      if (relation === 'spouse') {
        const res = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner1Id: personId,
            partner2Id: selectedId,
          }),
        });
        if (!res.ok) {
          toast.error('Failed to link spouse');
          return;
        }
      } else if (relation === 'father' || relation === 'mother') {
        // Create family with selected person as parent, then add current person as child
        const partnerKey =
          relation === 'father' ? 'partner1Id' : 'partner2Id';
        const famRes = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [partnerKey]: selectedId }),
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
      } else if (relation === 'child') {
        // Create family with current person as partner, then add selected as child
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
          body: JSON.stringify({ personId: selectedId }),
        });
        if (!childRes.ok) {
          toast.error('Failed to link child');
          return;
        }
      }

      toast.success('Person linked');
      setOpen(false);
      onLinked?.();
    } catch {
      toast.error('Network error');
    } finally {
      setLinking(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Link existing person
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <h4 className="text-sm font-medium">Link existing person</h4>

        {/* Relation type selector */}
        <Select
          value={relation}
          onValueChange={(v) => setRelation(v as RelationType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Relation type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spouse">Spouse</SelectItem>
            <SelectItem value="father">Father</SelectItem>
            <SelectItem value="mother">Mother</SelectItem>
            <SelectItem value="child">Child</SelectItem>
          </SelectContent>
        </Select>

        {/* Search input */}
        <Input
          placeholder="Search by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* Results list */}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {searching && (
            <p className="text-xs text-muted-foreground py-1">Searching...</p>
          )}
          {!searching && query.trim() && results.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">
              No results found
            </p>
          )}
          {results.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md border px-2 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm truncate">
                  {p.givenName} {p.surname}
                </span>
                <Badge variant={sexBadgeVariant[p.sex]} className="text-[10px] px-1 py-0">
                  {p.sex}
                </Badge>
                {p.birthDate && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    b. {p.birthDate}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                disabled={linking}
                onClick={() => handleLink(p.id)}
              >
                +
              </Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
