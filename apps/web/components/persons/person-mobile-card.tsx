'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  DataCard,
  DataCardBody,
  DataCardLeading,
  DataCardMeta,
  DataCardSubtitle,
  DataCardTitle,
} from '@/components/ui/data-card';
import { getCompletenessBreakdown } from '@/lib/persons/completeness';
import type { PersonListItem } from '@ancstra/shared';

const SEX_BG: Record<string, string> = {
  M: 'bg-[var(--sex-male-bg)] text-[var(--sex-male)]',
  F: 'bg-[var(--sex-female-bg)] text-[var(--sex-female)]',
  U: 'bg-[var(--sex-unknown-bg)] text-[var(--sex-unknown)]',
};

function initialsOf(givenName: string, surname: string): string {
  const g = (givenName?.[0] ?? '').toUpperCase();
  const s = (surname?.[0] ?? '').toUpperCase();
  return (g + s) || '?';
}

function lifespan(person: PersonListItem): string {
  const b = person.birthDate ?? '';
  const d = person.deathDate ?? '';
  if (!b && !d) return '';
  return `${b || '?'} — ${d || ''}`.replace(/—\s*$/, '— ').trim();
}

function formatRelative(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return null;
  }
}

interface PersonMobileCardProps {
  person: PersonListItem;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  /** When true, leading slot renders the selection checkbox. */
  showSelection: boolean;
}

export function PersonMobileCard({
  person,
  selected,
  onToggleSelect,
  showSelection,
}: PersonMobileCardProps) {
  const tHeaders = useTranslations('persons.table.headers');
  const tSex = useTranslations('persons.table.sex');
  const tValidation = useTranslations('persons.table.validation');
  const tTable = useTranslations('persons.table');

  const fullName = `${person.givenName} ${person.surname}`.trim();
  const span = lifespan(person);
  const updated = formatRelative(person.updatedAt);
  const compl = getCompletenessBreakdown(person);
  const isProposed = (person.validation ?? 'confirmed') === 'proposed';

  return (
    <DataCard selected={selected}>
      {showSelection ? (
        <DataCardLeading>
          <div className="flex min-h-11 min-w-11 items-center justify-center">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(person.id)}
              aria-label={
                selected
                  ? tTable('deselectPerson', { name: fullName })
                  : tTable('selectPerson', { name: fullName })
              }
            />
          </div>
        </DataCardLeading>
      ) : (
        <DataCardLeading>
          <Avatar className={`size-9 ${SEX_BG[person.sex] ?? ''}`}>
            <AvatarFallback className={SEX_BG[person.sex] ?? ''}>
              {initialsOf(person.givenName, person.surname)}
            </AvatarFallback>
          </Avatar>
        </DataCardLeading>
      )}

      <Link
        href={`/persons/${person.id}`}
        className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
        style={{ viewTransitionName: `person-${person.id}` }}
      >
        <DataCardBody>
          <DataCardTitle>
            <span className="text-primary">{fullName || tTable('emDash')}</span>
          </DataCardTitle>
          {span ? <DataCardSubtitle>{span}</DataCardSubtitle> : null}
          <DataCardMeta>
            <Badge variant="secondary" className="text-[0.7rem]">
              {tSex(person.sex)}
            </Badge>
            <span className="tabular-nums">
              {person.sourcesCount ?? 0} {tHeaders('sources').toLowerCase()}
            </span>
            {isProposed ? (
              <Badge
                variant="outline"
                className="border-status-warning-text bg-status-warning-bg text-status-warning-text text-[0.7rem]"
              >
                {tValidation('proposed')}
              </Badge>
            ) : null}
            <span
              className="ml-auto inline-flex items-center gap-1.5 tabular-nums"
              aria-label={`${tHeaders('completeness')} ${compl.total}%`}
            >
              <Progress value={compl.total} className="h-1.5 w-12" />
              <span>{compl.total}%</span>
            </span>
          </DataCardMeta>
          {updated ? (
            <DataCardSubtitle className="text-[0.7rem]">
              {tHeaders('lastEdited')}: {updated}
            </DataCardSubtitle>
          ) : null}
        </DataCardBody>
      </Link>
    </DataCard>
  );
}
