'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Role } from '@ancstra/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ResponsiveTable,
  MobileCardList,
  MobileCardListItem,
  MobileCardListEmpty,
} from '@/components/ui/responsive-table';
import { MemberMobileCard } from './member-mobile-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RoleBadge } from '@/components/auth/role-badge';
import { RoleGate } from '@/components/auth/role-gate';
import { Loader2, MoreHorizontal, Crown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { TransferOwnershipDialog } from '@/components/members/transfer-ownership-dialog';

const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;
const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, editor: 2, viewer: 3 };

type SortKey = 'joined' | 'lastSeen' | 'role' | 'name';
type ActivityFilter = 'all' | 'active' | 'inactive' | 'never';

function classifyActivity(lastSeenAt: string | null): 'active' | 'inactive' | 'never' {
  if (!lastSeenAt) return 'never';
  try {
    const ms = Date.now() - new Date(lastSeenAt).getTime();
    return ms > STALE_THRESHOLD_MS ? 'inactive' : 'active';
  } catch {
    return 'never';
  }
}

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  lastSeenAt: string | null;
  name: string | null;
  email: string;
}

interface MemberListProps {
  familyId: string;
  familyName: string;
  currentUserId: string;
  currentRole: Role;
}

const ASSIGNABLE_ROLES = ['admin', 'editor', 'viewer'] as const;

function formatLastSeen(value: string | null): string {
  if (!value) return '—';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function MemberList({
  familyId,
  familyName,
  currentUserId,
  currentRole,
}: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('joined');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);

  const canBulkManage = currentRole === 'owner' || currentRole === 'admin';

  const fetchMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/families/${familyId}/members`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to load members');
      }
      const data: Member[] = await res.json();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const canEditRole = (member: Member) => {
    if (member.userId === currentUserId) return false;
    if (member.role === 'owner') return false;
    if (currentRole === 'admin' && member.role === 'admin') return false;
    return true;
  };

  const canRemove = (member: Member) => {
    if (member.role === 'owner') return false;
    if (member.userId === currentUserId) return false;
    if (currentRole === 'admin' && member.role === 'admin') return false;
    return true;
  };

  const canTransferTo = (member: Member) => {
    if (currentRole !== 'owner') return false;
    if (member.role !== 'admin') return false;
    if (member.userId === currentUserId) return false;
    return true;
  };

  async function handleRoleChange(targetUserId: string, newRole: string) {
    setUpdatingRole(targetUserId);
    try {
      const res = await fetch(`/api/families/${familyId}/members/${targetUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to update role');
      }
      const updated: Member = await res.json();
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? updated : m))
      );
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingRole(null);
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    const targetUserId = removeTarget.userId;
    const memberName = removeTarget.name;
    setRemovingMember(targetUserId);
    try {
      const res = await fetch(`/api/families/${familyId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to remove member');
      }
      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
      toast.success(`${memberName ?? 'Member'} has been removed`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  }

  async function handleBulkRoleChange(newRole: 'admin' | 'editor' | 'viewer') {
    const targetIds = Array.from(selected);
    if (targetIds.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      targetIds.map((id) =>
        fetch(`/api/families/${familyId}/members/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Failed for ${id}`);
          }
          return id;
        }),
      ),
    );
    setBulkBusy(false);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (failed === 0) {
      toast.success(`Updated ${ok} member${ok === 1 ? '' : 's'} to ${newRole}`);
    } else {
      toast.error(`Updated ${ok} of ${results.length}; ${failed} failed`);
    }
    setSelected(new Set());
    fetchMembers();
  }

  async function handleBulkRemove() {
    const targetIds = Array.from(selected);
    if (targetIds.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      targetIds.map((id) =>
        fetch(`/api/families/${familyId}/members/${id}`, {
          method: 'DELETE',
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Failed for ${id}`);
          }
          return id;
        }),
      ),
    );
    setBulkBusy(false);
    setBulkRemoveOpen(false);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (failed === 0) {
      toast.success(`Removed ${ok} member${ok === 1 ? '' : 's'}`);
    } else {
      toast.error(`Removed ${ok} of ${results.length}; ${failed} failed`);
    }
    setSelected(new Set());
    fetchMembers();
  }

  const visibleMembers = useMemo(() => {
    const filtered = activityFilter === 'all'
      ? members
      : members.filter((m) => classifyActivity(m.lastSeenAt) === activityFilter);

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'joined') {
        return b.joinedAt.localeCompare(a.joinedAt);
      }
      if (sortBy === 'lastSeen') {
        // Members who have never signed in sort last.
        if (!a.lastSeenAt && !b.lastSeenAt) return 0;
        if (!a.lastSeenAt) return 1;
        if (!b.lastSeenAt) return -1;
        return b.lastSeenAt.localeCompare(a.lastSeenAt);
      }
      if (sortBy === 'role') {
        const ra = ROLE_ORDER[a.role] ?? 99;
        const rb = ROLE_ORDER[b.role] ?? 99;
        if (ra !== rb) return ra - rb;
        return (a.name ?? a.email).localeCompare(b.name ?? b.email);
      }
      // name
      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });
    return sorted;
  }, [members, sortBy, activityFilter]);

  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let never = 0;
    for (const m of members) {
      const c = classifyActivity(m.lastSeenAt);
      if (c === 'active') active++;
      else if (c === 'inactive') inactive++;
      else never++;
    }
    return { active, inactive, never, total: members.length };
  }, [members]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchMembers}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger size="sm" className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="joined">Joined</SelectItem>
              <SelectItem value="lastSeen">Last seen</SelectItem>
              <SelectItem value="role">Role</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-2">Show:</span>
          <Select
            value={activityFilter}
            onValueChange={(v) => setActivityFilter(v as ActivityFilter)}
          >
            <SelectTrigger size="sm" className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.total})</SelectItem>
              <SelectItem value="active">Active ({counts.active})</SelectItem>
              <SelectItem value="inactive">Inactive 90d+ ({counts.inactive})</SelectItem>
              <SelectItem value="never">Never signed in ({counts.never})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {visibleMembers.length} of {counts.total}
        </span>
      </div>
      {canBulkManage && selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/95 px-4 py-2 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{selected.size}</span>
            <span className="text-muted-foreground">
              member{selected.size === 1 ? '' : 's'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              onValueChange={(v) => handleBulkRoleChange(v as 'admin' | 'editor' | 'viewer')}
              disabled={bulkBusy}
            >
              <SelectTrigger size="sm" className="h-8 w-[170px]">
                <SelectValue placeholder="Change role to…" />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    Make {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkRemoveOpen(true)}
              disabled={bulkBusy}
            >
              {bulkBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Remove
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <ResponsiveTable
        desktop={
        <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {canBulkManage ? (
                <TableHead className="w-[40px]">
                  {(() => {
                    const selectable = visibleMembers.filter((m) => canRemove(m));
                    const allSelected =
                      selectable.length > 0 &&
                      selectable.every((m) => selected.has(m.userId));
                    const someSelected =
                      selectable.some((m) => selected.has(m.userId)) && !allSelected;
                    return (
                      <Checkbox
                        aria-label="Select all selectable members"
                        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                        onCheckedChange={(value) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (value) {
                              for (const m of selectable) next.add(m.userId);
                            } else {
                              for (const m of selectable) next.delete(m.userId);
                            }
                            return next;
                          });
                        }}
                        disabled={bulkBusy || selectable.length === 0}
                      />
                    );
                  })()}
                </TableHead>
              ) : null}
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMembers.map((member) => {
              const showMenu = canRemove(member) || canTransferTo(member);
              const isSelectable = canRemove(member);
              const isChecked = selected.has(member.userId);
              return (
                <TableRow key={member.userId} data-state={isChecked ? 'selected' : undefined}>
                  {canBulkManage ? (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${member.name ?? member.email}`}
                        checked={isChecked}
                        disabled={!isSelectable || bulkBusy}
                        onCheckedChange={(value) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (value) next.add(member.userId);
                            else next.delete(member.userId);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="font-medium">
                    {member.name ?? 'Unknown'}
                    {member.userId === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
                    {canEditRole(member) ? (
                      <RoleGate
                        permission="members:manage"
                        fallback={<RoleBadge role={member.role} />}
                      >
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleRoleChange(member.userId, value)}
                          disabled={updatingRole === member.userId}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </RoleGate>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{formatLastSeen(member.lastSeenAt)}</span>
                      {classifyActivity(member.lastSeenAt) === 'inactive' ? (
                        <Badge variant="outline" className="h-5 text-xs">
                          Inactive
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {showMenu && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Member actions"
                            disabled={removingMember === member.userId}
                          >
                            {removingMember === member.userId ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canTransferTo(member) && (
                            <RoleGate permission="members:transfer-ownership">
                              <DropdownMenuItem
                                onClick={() => setTransferTarget(member)}
                              >
                                <Crown className="size-4 mr-2" />
                                Transfer ownership
                              </DropdownMenuItem>
                            </RoleGate>
                          )}
                          {canTransferTo(member) && canRemove(member) && (
                            <DropdownMenuSeparator />
                          )}
                          {canRemove(member) && (
                            <RoleGate permission="members:manage">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setRemoveTarget(member)}
                              >
                                <Trash2 className="size-4 mr-2" />
                                Remove member
                              </DropdownMenuItem>
                            </RoleGate>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {visibleMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={canBulkManage ? 7 : 6} className="text-center text-muted-foreground py-8">
                  {members.length === 0
                    ? 'No members found.'
                    : 'No members match the selected filter.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
        }
        mobile={
          visibleMembers.length === 0 ? (
            <MobileCardListEmpty>
              {members.length === 0
                ? 'No members found.'
                : 'No members match the selected filter.'}
            </MobileCardListEmpty>
          ) : (
            <MobileCardList>
              {visibleMembers.map((member) => {
                const showMenu = canRemove(member) || canTransferTo(member);
                const isSelectable = canRemove(member);
                const isChecked = selected.has(member.userId);
                return (
                  <MobileCardListItem key={member.userId}>
                    <MemberMobileCard
                      member={member}
                      isYou={member.userId === currentUserId}
                      selected={isChecked}
                      bulkBusy={bulkBusy}
                      showCheckbox={canBulkManage}
                      isSelectable={isSelectable}
                      showRoleEditor={canEditRole(member)}
                      showMenu={showMenu}
                      showTransfer={canTransferTo(member)}
                      showRemove={canRemove(member)}
                      updatingRole={updatingRole === member.userId}
                      removingMember={removingMember === member.userId}
                      onToggleSelect={(id, value) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (value) next.add(id);
                          else next.delete(id);
                          return next;
                        })
                      }
                      onRoleChange={handleRoleChange}
                      onTransfer={(m) => setTransferTarget(m)}
                      onRemove={(m) => setRemoveTarget(m)}
                    />
                  </MobileCardListItem>
                );
              })}
            </MobileCardList>
          )
        }
      />

      {transferTarget && (
        <TransferOwnershipDialog
          open={!!transferTarget}
          onOpenChange={(o) => !o && setTransferTarget(null)}
          member={transferTarget}
          familyId={familyId}
          familyName={familyName}
          onTransferred={() => {
            fetchMembers();
            setTransferTarget(null);
          }}
        />
      )}

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{removeTarget?.name ?? removeTarget?.email}</strong> from
              this family? They will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConfirm}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkRemoveOpen} onOpenChange={setBulkRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {selected.size} member{selected.size === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each selected member will lose access to this family immediately.
              Failures (e.g. permission errors) are reported per-member; the
              other removals will still apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing…
                </>
              ) : (
                `Remove ${selected.size}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
