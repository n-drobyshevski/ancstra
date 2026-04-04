'use client';

import type { PersonListItem } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { sexTokens, getInitials, computeLifespan } from './detail-sections';

interface TreePersonCardProps {
  person: PersonListItem;
  birthPlace?: string;
  onSelect: () => void;
}

export function TreePersonCard({ person, birthPlace, onSelect }: TreePersonCardProps) {
  const tokens = sexTokens[person.sex];
  const lifespan = computeLifespan(person.birthDate, person.deathDate);

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted border-b border-border"
      onClick={onSelect}
      aria-label={`${person.givenName} ${person.surname}${lifespan ? `, ${lifespan}` : ''}`}
    >
      {/* Avatar */}
      <div
        className="size-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold"
        style={{ backgroundColor: tokens.bg, color: tokens.text }}
      >
        {getInitials(person.givenName, person.surname)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {person.givenName} {person.surname}
        </div>
        {lifespan && (
          <div className="text-xs text-muted-foreground truncate">{lifespan}</div>
        )}
        {birthPlace && (
          <div className="text-[11px] text-muted-foreground/70 truncate">{birthPlace}</div>
        )}
      </div>

      {/* Sex badge */}
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
        {person.sex}
      </Badge>
    </button>
  );
}
