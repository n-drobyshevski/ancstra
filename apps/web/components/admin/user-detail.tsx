import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShieldCheck, Mail, Calendar, RefreshCw } from 'lucide-react';
import { TogglePlatformAdmin } from './toggle-platform-admin';
import type { UserDetail as UserDetailData } from '@ancstra/auth/admin';

interface Props {
  data: UserDetailData;
  viewerUserId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
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

export function UserDetail({ data, viewerUserId }: Props) {
  const { user, memberships } = data;
  const isSelf = user.id === viewerUserId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-lg">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl truncate">{user.name}</CardTitle>
                {user.isPlatformAdmin ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="size-3" />
                    Platform admin
                  </Badge>
                ) : null}
                {!user.emailVerified ? (
                  <Badge variant="outline">Email unverified</Badge>
                ) : null}
                {isSelf ? <Badge variant="outline">You</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {user.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  Joined {formatDate(user.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="size-3.5" />
                  Updated {formatDate(user.updatedAt)}
                </span>
              </div>
            </div>
            <TogglePlatformAdmin
              userId={user.id}
              userName={user.name}
              isCurrentlyAdmin={user.isPlatformAdmin}
              isSelf={isSelf}
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Family memberships ({memberships.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              This user has not joined any families.
            </p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Family</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead aria-label="Status"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((m) => (
                    <TableRow key={m.familyId}>
                      <TableCell>
                        <Link
                          href={`/admin/families/${m.familyId}`}
                          className="font-medium hover:underline focus:underline focus:outline-none"
                        >
                          {m.familyName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {m.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(m.joinedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(m.lastSeenAt)}
                      </TableCell>
                      <TableCell>
                        {!m.isActive ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            inactive
                          </Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
