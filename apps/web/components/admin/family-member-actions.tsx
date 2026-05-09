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
import { useTranslations } from 'next-intl';
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
type AssignableRole = Exclude<Role, 'owner'>;

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

const ASSIGNABLE: ReadonlyArray<AssignableRole> = ['admin', 'editor', 'viewer'];

export function FamilyMemberActions({ familyId, familyName, member }: Props) {
  const router = useRouter();
  const t = useTranslations('admin.familyMemberActions');
  const tRoles = useTranslations('admin.familyMemberActions.roles');
  const tCommon = useTranslations('common');
  const [removeOpen, setRemoveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [addToFamilyOpen, setAddToFamilyOpen] = useState(false);
  const [moveToFamilyOpen, setMoveToFamilyOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const changeRole = trpc.platformAdmin.changeMemberRole.useMutation({
    onSuccess: ({ changed }) => {
      toast.success(changed ? t('roleUpdated') : t('roleUnchanged'));
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t('roleUpdateFailed')),
  });

  const remove = trpc.platformAdmin.removeMember.useMutation({
    onSuccess: () => {
      toast.success(t('removed', { name: member.userName }));
      setRemoveOpen(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t('removeFailed')),
  });

  const transfer = trpc.platformAdmin.forceTransferOwnership.useMutation({
    onSuccess: ({ changed }) => {
      toast.success(changed ? t('transferred', { name: member.userName }) : t('noChange'));
      setTransferOpen(false);
      setConfirmName('');
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t('transferFailed')),
  });

  const isPending = changeRole.isPending || remove.isPending || transfer.isPending;
  const isOwner = member.role === 'owner';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('ariaLabel', { name: member.userName })}
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
            {isOwner ? t('ownerLabel') : t('platformOverrideLabel')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {!isOwner ? (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ShieldOff className="size-4 mr-2" />
                  {t('changeRole')}
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
                      <span className="capitalize">{tRoles(r)}</span>
                      {r === member.role ? (
                        <span className="ml-auto text-xs text-muted-foreground">{t('current')}</span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {member.role === 'admin' ? (
                <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                  <Crown className="size-4 mr-2" />
                  {t('forceTransfer')}
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={() => setAddToFamilyOpen(true)}>
            <UserPlus className="size-4 mr-2" />
            {t('addToFamily')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isOwner}
            onClick={() => setMoveToFamilyOpen(true)}
          >
            <ArrowLeftRight className="size-4 mr-2" />
            {t('moveToFamily')}
            {isOwner ? (
              <span className="ml-auto text-xs text-muted-foreground">{t('ownerDisabledReason')}</span>
            ) : null}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isOwner}
            className="text-destructive focus:text-destructive"
            onClick={() => setRemoveOpen(true)}
          >
            <Trash2 className="size-4 mr-2" />
            {t('remove')}
            {isOwner ? (
              <span className="ml-auto text-xs text-muted-foreground">{t('ownerDisabledReason')}</span>
            ) : null}
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
            <AlertDialogTitle>{t('removeTitle', { name: member.userName })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.rich('removeDescription', {
                family: familyName,
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{tCommon('buttons.cancel')}</AlertDialogCancel>
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
                  {tCommon('states.loading')}
                </>
              ) : (
                t('remove')
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
              {t('transferTitle', { name: member.userName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('transferDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-transfer-family-name">
              {t.rich('typeFamilyToConfirm', {
                family: familyName,
                b: (chunks) => <strong>{chunks}</strong>,
              })}
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
            <AlertDialogCancel disabled={transfer.isPending}>{tCommon('buttons.cancel')}</AlertDialogCancel>
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
                  {tCommon('states.loading')}
                </>
              ) : (
                t('forceTransfer')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
