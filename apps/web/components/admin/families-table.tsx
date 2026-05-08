import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FamiliesRowActions } from '@/components/admin/families-row-actions';
import { CountWithNamesTooltip } from '@/components/admin/count-with-names-tooltip';
import type { FamilyListRow } from '@ancstra/auth/admin';

interface Props {
  rows: FamilyListRow[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function FamiliesTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No families found.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Family</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead className="text-right">Pending invites</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Link
                  href={`/admin/families/${f.id}`}
                  className="font-medium hover:underline focus:underline focus:outline-none"
                >
                  {f.name}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  href={`/admin/users/${f.ownerId}`}
                  className="text-muted-foreground hover:underline focus:underline focus:outline-none"
                >
                  {f.ownerName}
                  <span className="block text-xs opacity-70 truncate max-w-[14rem]">
                    {f.ownerEmail}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <CountWithNamesTooltip
                  count={f.memberCount}
                  names={f.memberNames}
                  hint="Active members"
                  ariaNoun="active members"
                />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {f.pendingInviteCount > 0 ? (
                  <Badge variant="outline">{f.pendingInviteCount}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(f.createdAt)}</TableCell>
              <TableCell className="text-right">
                <FamiliesRowActions
                  family={{ id: f.id, name: f.name, ownerEmail: f.ownerEmail }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
