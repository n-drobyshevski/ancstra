'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  Crown,
  Loader2,
  MoreHorizontal,
  ShieldOff,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoveOrAddMemberDialog } from '@/components/admin/move-or-add-member-dialog';

type Role = 'owner' | 'admin' | 'editor' | 'viewer';

interface Props {
  familyId: string;
  familyName: string;
  member: {
    userId: string;
    userName: string;
    userEmail: string;
    role: Role;
  };
}

const ASSIGNABLE: ReadonlyArray<Exclude<Role, 'owner'>> = ['admin', 'editor', 'viewer'];

export function FamilyMemberActions({ familyId, familyName, member }: Props) {
  const router = useRouter();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [addToFamilyOpen, setAddToFamilyOpen] = useState(false);
  const [moveToFamilyOpen, setMoveToFamilyOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const changeRole = trpc.platformAdmin.changeMemberRole.useMutation({
    onSuccess: ({ changed }) => {
      toast.success(changed ? 'Role updated' : 'Role unchanged');
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to update role'),
  });

  const remove = trpc.platformAdmin.removeMember.useMutation({
    onSuccess: () => {
      toast.success(`Removed ${member.userName}`);
      setRemoveOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to remove member'),
  });

  const transfer = trpc.platformAdmin.forceTransferOwnership.useMutation({
    onSuccess: ({ changed }) => {
      toast.success(changed ? `Ownership transferred to ${member.userName}` : 'No change');
      setTransferOpen(false);
      setConfirmName('');
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to transfer ownership'),
  });

  const isPending = changeRole.isPending || remove.isPending || transfer.isPending;

  // Owner row: only "transfer FROM" is meaningful, but that's done via the
  // target admin's row. So owner gets no action menu here.
  if (member.role === 'owner') {
    return (
      <span className="text-xs text-muted-foreground italic">owner</span>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${member.userName}`}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">
            Platform-admin override
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ShieldOff className="size-4 mr-2" />
              Change role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {ASSIGNABLE.map((r) => (
                <DropdownMenuItem
                  key={r}
                  disabled={r === member.role || changeRole.isPending}
                  onClick={() =>
                    changeRole.mutate({
                      familyId,
                      userId: member.userId,
                      role: r,
                    })
                  }
                >
                  <span className="capitalize">{r}</span>
                  {r === member.role ? (
                    <span className="ml-auto text-xs text-muted-foreground">current</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {member.role === 'admin' ? (
            <DropdownMenuItem onClick={() => setTransferOpen(true)}>
              <Crown className="size-4 mr-2" />
              Force transfer ownership
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAddToFamilyOpen(true)}>
            <UserPlus className="size-4 mr-2" />
            Add to another family…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveToFamilyOpen(true)}>
            <ArrowLeftRight className="size-4 mr-2" />
            Move to another family…
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2 className="size-4 mr-2" />
            Remove member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MoveOrAddMemberDialog
        mode="add"
        open={addToFamilyOpen}
        onOpenChange={setAddToFamilyOpen}
        currentFamilyId={familyId}
        currentFamilyName={familyName}
        user={{
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
        }}
      />

      <MoveOrAddMemberDialog
        mode="move"
        open={moveToFamilyOpen}
        onOpenChange={setMoveToFamilyOpen}
        currentFamilyId={familyId}
        currentFamilyName={familyName}
        user={{
          id: member.userId,
          name: member.userName,
          email: member.userEmail,
        }}
      />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.userName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to <strong>{familyName}</strong> immediately.
              The action is logged in the audit log and the family activity feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove.mutate({ familyId, userId: member.userId });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing…
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={transferOpen}
        onOpenChange={(o) => {
          if (!o) setConfirmName('');
          setTransferOpen(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Force transfer ownership to {member.userName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The current owner will be demoted to admin. This is a
              platform-admin override and is logged in the audit log and the
              family activity feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-transfer-family-name">
              Type the family name <strong>{familyName}</strong> to confirm
            </Label>
            <Input
              id="confirm-transfer-family-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              placeholder={familyName}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transfer.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmName.trim() !== familyName || transfer.isPending}
              onClick={(e) => {
                e.preventDefault();
                transfer.mutate({ familyId, newOwnerUserId: member.userId });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {transfer.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Transferring…
                </>
              ) : (
                'Force transfer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
