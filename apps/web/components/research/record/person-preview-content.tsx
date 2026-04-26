'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  MapPin,
  Users,
  Heart,
  Baby,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { PersonDetail } from '@ancstra/shared';
import { Avatar, AvatarFallback, AvatarBadge } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface PersonPreviewContentProps {
  personId: string;
  onNavigate?: () => void;
}

function getInitials(givenName: string, surname: string): string {
  return `${givenName.charAt(0)}${surname.charAt(0)}`.toUpperCase().trim() || '?';
}

function PreviewSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Separator />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function PersonPreviewContent({ personId, onNavigate }: PersonPreviewContentProps) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setPerson(null);
    setNotesExpanded(false);

    let cancelled = false;
    fetch(`/api/persons/${personId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setPerson(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [personId]);

  if (loading) return <PreviewSkeleton />;
  if (!person) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
        <p className="text-sm">Could not load person details.</p>
      </div>
    );
  }

  const fullName = [person.prefix, person.givenName, person.surname, person.suffix]
    .filter(Boolean)
    .join(' ');
  const hasBirth = person.birthDate || person.birthPlace;
  const hasDeath = person.deathDate || person.deathPlace;
  const notesLines = person.notes?.split('\n') ?? [];
  const notesLong = notesLines.length > 3;
  const displayedNotes = notesExpanded ? person.notes : notesLines.slice(0, 3).join('\n');

  const relCounts = [
    person.parents.length > 0 && `${person.parents.length} parent${person.parents.length > 1 ? 's' : ''}`,
    person.spouses.length > 0 && `${person.spouses.length} spouse${person.spouses.length > 1 ? 's' : ''}`,
    person.children.length > 0 && `${person.children.length} ${person.children.length > 1 ? 'children' : 'child'}`,
  ].filter(Boolean);

  const eventCount = person.events.length;

  return (
    <div className="flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <Avatar size="lg" className="size-12">
          <AvatarFallback className="text-base">
            {getInitials(person.givenName, person.surname)}
          </AvatarFallback>
          {person.sex !== 'U' && (
            <AvatarBadge className="!size-3.5 text-[8px] font-bold">
              {person.sex === 'M' ? '♂' : '♀'}
            </AvatarBadge>
          )}
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight truncate">{fullName}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {person.sex === 'M' ? 'Male' : person.sex === 'F' ? 'Female' : 'Unknown'}
            </Badge>
            {person.isLiving && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-500/50 text-green-600">
                Living
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Vitals */}
      {(hasBirth || hasDeath) && (
        <div className="p-4 space-y-2.5">
          {hasBirth && (
            <div className="flex gap-3 border-l-2 border-primary/20 pl-3 text-sm">
              <span className="w-10 shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Born
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-foreground/80">
                {person.birthDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3 text-muted-foreground" />
                    {person.birthDate}
                  </span>
                )}
                {person.birthPlace && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" />
                    {person.birthPlace}
                  </span>
                )}
              </div>
            </div>
          )}
          {hasDeath && (
            <div className="flex gap-3 border-l-2 border-primary/20 pl-3 text-sm">
              <span className="w-10 shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Died
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-foreground/80">
                {person.deathDate && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3 text-muted-foreground" />
                    {person.deathDate}
                  </span>
                )}
                {person.deathPlace && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" />
                    {person.deathPlace}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(hasBirth || hasDeath) && (relCounts.length > 0 || eventCount > 0 || person.notes) && (
        <Separator />
      )}

      {/* Relationships & Events summary */}
      {(relCounts.length > 0 || eventCount > 0) && (
        <div className="p-4 space-y-2">
          {relCounts.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-3.5 shrink-0" />
              <span>{relCounts.join(', ')}</span>
            </div>
          )}
          {eventCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              <span>{eventCount} life event{eventCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {person.notes && (
        <>
          <Separator />
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              Notes
            </p>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {displayedNotes}
            </p>
            {notesLong && (
              <button
                type="button"
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="mt-1 text-xs text-primary hover:underline"
              >
                {notesExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-auto p-4 pt-2">
        <Link href={`/persons/${personId}`} onClick={onNavigate}>
          <Button variant="default" size="sm" className="w-full">
            Open full record
            <ExternalLink className="ml-1.5 size-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
