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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShieldCheck } from 'lucide-react';
import { UsersRowActions } from '@/components/admin/users-row-actions';
import { CountWithNamesTooltip } from '@/components/admin/count-with-names-tooltip';
import type { UserListRow } from '@ancstra/auth/admin';

interface Props {
  rows: UserListRow[];
  currentUserId: string;
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

function initials(name: string, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

export function UsersTable({ rows, currentUserId }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No users found.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Family trees</TableHead>
            <TableHead className="text-right">Owned</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead aria-label="Platform admin" />
            <TableHead className="w-12" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <Link
                  href={`/admin/users/${u.id}`}
                  className="flex items-center gap-3 hover:underline focus:underline focus:outline-none"
                >
                  <Avatar className="size-8 shrink-0">
                    {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{initials(u.name, u.email)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium truncate max-w-[12rem]">{u.name}</span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground truncate max-w-[16rem]">
                {u.email}
                {!u.emailVerified ? (
                  <Badge variant="outline" className="ml-2 text-xs">unverified</Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <CountWithNamesTooltip
                  count={u.familyCount}
                  names={u.familyNames}
                  hint="Active memberships"
                  ariaNoun="family memberships"
                />
              </TableCell>
              <TableCell className="text-right">
                <CountWithNamesTooltip
                  count={u.ownedFamilyCount}
                  names={u.ownedFamilyNames}
                  hint="Owned family trees"
                  ariaNoun="owned family trees"
                />
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
              <TableCell>
                {u.isPlatformAdmin ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="size-3" />
                    Admin
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <UsersRowActions
                  user={{
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    isPlatformAdmin: u.isPlatformAdmin,
                  }}
                  currentUserId={currentUserId}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
