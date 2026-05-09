'use client';

import Link from 'next/link';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PersonListItem } from '@ancstra/shared';

function formatRelative(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function PersonTable({ persons }: { persons: PersonListItem[] }) {
  const tHeaders = useTranslations('persons.table.headers');
  const tSex = useTranslations('common.sexLabels');
  const tValidation = useTranslations('persons.table.validation');
  const tEmpty = useTranslations('persons.table');

  if (persons.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tEmpty('noPersonsMatch')}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tHeaders('name')}</TableHead>
          <TableHead className="w-16">{tHeaders('sex')}</TableHead>
          <TableHead className="w-24">{tHeaders('birth')}</TableHead>
          <TableHead className="w-24">{tHeaders('death')}</TableHead>
          <TableHead className="w-32">{tHeaders('completeness')}</TableHead>
          <TableHead className="w-20 text-right">{tHeaders('sources')}</TableHead>
          <TableHead className="w-24">{tHeaders('validation')}</TableHead>
          <TableHead className="w-32">{tHeaders('lastEdited')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {persons.map((person) => {
          const completeness = person.completeness ?? 0;
          const sourcesCount = person.sourcesCount ?? 0;
          const validation = person.validation ?? 'confirmed';
          return (
            <TableRow key={person.id}>
              <TableCell>
                <Link
                  href={`/persons/${person.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  style={{ viewTransitionName: `person-${person.id}` }}
                >
                  {person.givenName} {person.surname}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {tSex(person.sex)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {person.birthDate ?? '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {person.deathDate ?? '—'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={completeness} className="h-2 w-20" aria-label={`${completeness}% complete`} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {completeness}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {sourcesCount}
              </TableCell>
              <TableCell>
                {validation === 'proposed' ? (
                  <Badge variant="outline" className="border-status-warning-text bg-status-warning-bg text-status-warning-text">
                    {tValidation('proposed')}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{tValidation('confirmed')}</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatRelative(person.updatedAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
