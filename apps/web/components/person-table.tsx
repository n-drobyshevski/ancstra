'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PersonListItem } from '@ancstra/shared';

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

export function PersonTable({ persons }: { persons: PersonListItem[] }) {
  if (persons.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No persons found.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Sex</TableHead>
          <TableHead>Birth</TableHead>
          <TableHead>Death</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {persons.map((person) => (
          <TableRow key={person.id}>
            <TableCell>
              <Link
                href={`/person/${person.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {person.givenName} {person.surname}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {sexLabel[person.sex]}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {person.birthDate ?? '—'}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {person.deathDate ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
