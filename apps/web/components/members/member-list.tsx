'use client';

import { useCallback, useEffect, useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/auth/role-badge';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  name: string | null;
  email: string;
}

interface MemberListProps {
  familyId: string;
  currentUserId: string;
  currentRole: Role;
}

const ASSIGNABLE_ROLES = ['admin', 'editor', 'viewer'] as const;

export function MemberList({ familyId, currentUserId, currentRole }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

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

  async function handleRemove(targetUserId: string, memberName: string | null) {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  }

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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-[70px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.userId}>
              <TableCell className="font-medium">
                {member.name ?? 'Unknown'}
                {member.userId === currentUserId && (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{member.email}</TableCell>
              <TableCell>
                {canEditRole(member) ? (
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
                ) : (
                  <RoleBadge role={member.role} />
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(member.joinedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {canRemove(member) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={removingMember === member.userId}
                        aria-label="Remove member"
                      >
                        {removingMember === member.userId ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove member</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove{' '}
                          <strong>{member.name ?? member.email}</strong> from this
                          family? They will lose access immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemove(member.userId, member.name)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          ))}
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No members found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
