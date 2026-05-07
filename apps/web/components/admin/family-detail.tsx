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
import { Calendar, Database, Users as UsersIcon, Coins, Shield } from 'lucide-react';
import type { FamilyDetail as FamilyDetailData } from '@ancstra/auth/admin';
import { FamilySettingsEditButton } from '@/components/admin/family-settings-edit-button';
import { FamilyMemberActions } from '@/components/admin/family-member-actions';
import { FamilyPendingInvitations } from '@/components/admin/family-pending-invitations';

interface Props {
  data: FamilyDetailData;
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

export function FamilyDetail({ data }: Props) {
  const { family, members, invitations } = data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{family.name}</CardTitle>
              {family.moderationEnabled ? (
                <Badge variant="outline" className="gap-1">
                  <Shield className="size-3" />
                  Moderation on
                </Badge>
              ) : null}
            </div>
            <FamilySettingsEditButton
              familyId={family.id}
              initial={{
                name: family.name,
                maxMembers: family.maxMembers,
                monthlyAiBudgetUsd: family.monthlyAiBudgetUsd,
                moderationEnabled: family.moderationEnabled,
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <UsersIcon className="size-3.5" /> Max members
              </dt>
              <dd className="font-medium tabular-nums mt-1">{family.maxMembers}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Coins className="size-3.5" /> Monthly AI budget
              </dt>
              <dd className="font-medium tabular-nums mt-1">
                ${family.monthlyAiBudgetUsd.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Database className="size-3.5" /> DB filename
              </dt>
              <dd className="font-mono text-xs mt-1 truncate" title={family.dbFilename}>
                {family.dbFilename}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Created
              </dt>
              <dd className="font-medium mt-1">{formatDate(family.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <FamilyPendingInvitations familyId={family.id} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Members ({members.length})
          </CardTitle>
          {invitations.pending > 0 ? (
            <Badge variant="outline">
              {invitations.pending} pending invite{invitations.pending === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No members.</p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead aria-label="Status"></TableHead>
                    <TableHead className="w-[60px]" aria-label="Actions"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell>
                        <Link
                          href={`/admin/users/${m.userId}`}
                          className="flex items-center gap-3 hover:underline focus:underline focus:outline-none"
                        >
                          <Avatar className="size-8 shrink-0">
                            {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                            <AvatarFallback>{initials(m.userName, m.userEmail)}</AvatarFallback>
                          </Avatar>
                          <span>
                            <span className="font-medium block truncate max-w-[14rem]">
                              {m.userName}
                            </span>
                            <span className="block text-xs text-muted-foreground truncate max-w-[14rem]">
                              {m.userEmail}
                            </span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.role === 'owner' ? 'secondary' : 'outline'}
                          className="capitalize"
                        >
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
                      <TableCell>
                        {m.isActive ? (
                          <FamilyMemberActions
                            familyId={family.id}
                            familyName={family.name}
                            member={{
                              userId: m.userId,
                              userName: m.userName,
                              userEmail: m.userEmail,
                              role: m.role as 'owner' | 'admin' | 'editor' | 'viewer',
                            }}
                          />
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
