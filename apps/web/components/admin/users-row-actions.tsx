'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserFamilyTransferDialog } from '@/components/admin/user-family-transfer-dialog';

interface Props {
  user: {
    id: string;
    name: string;
    email: string;
    isPlatformAdmin: boolean;
  };
  currentUserId: string;
}

export function UsersRowActions({ user, currentUserId }: Props) {
  const router = useRouter();
  const t = useTranslations('admin.users.rowActions');
  const tCommon = useTranslations('common');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'add' | 'move' | null>(null);
  const isSelf = user.id === currentUserId;
  const promoting = !user.isPlatformAdmin;

  const toggle = trpc.platformAdmin.togglePlatformAdmin.useMutation({
    onSuccess: () => {
      toast.success(promoting ? t('promoted', { name: user.name }) : t('demoted', { name: user.name }));
      setConfirmOpen(false);
      router.refresh();
    },
    onError: (err) =>
      toast.error(err.message || t('updateFailed')),
  });

  async function copy(value: string, kind: 'idCopied' | 'emailCopied') {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t(kind));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  const isPending = toggle.isPending;
  const ToggleIcon = promoting ? ShieldCheck : ShieldOff;
  const toggleLabel = promoting ? t('promote') : t('demote');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('ariaLabel', { name: user.name })}
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
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${user.id}`}>
              <ExternalLink className="size-4" />
              {t('open')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            variant={promoting ? 'default' : 'destructive'}
          >
            <ToggleIcon className="size-4" />
            {toggleLabel}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTransferMode('add')}>
            <UserPlus className="size-4" />
            {t('addToFamily')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTransferMode('move')}>
            <ArrowLeftRight className="size-4" />
            {t('moveToFamily')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => copy(user.id, 'idCopied')}>
            <Copy className="size-4" />
            {t('copyId')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copy(user.email, 'emailCopied')}>
            <Copy className="size-4" />
            {t('copyEmail')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserFamilyTransferDialog
        mode={transferMode ?? 'add'}
        open={transferMode !== null}
        onOpenChange={(o) => {
          if (!o) setTransferMode(null);
        }}
        user={{ id: user.id, name: user.name, email: user.email }}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {promoting ? t('promoteTitle') : t('demoteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {promoting
                ? t('promoteDescription', { name: user.name })
                : isSelf
                  ? t('demoteSelfDescription')
                  : t('demoteOtherDescription', { name: user.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggle.isPending}>
              {tCommon('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={toggle.isPending}
              onClick={(e) => {
                e.preventDefault();
                toggle.mutate({ userId: user.id, value: promoting });
              }}
              className={
                !promoting
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {toggle.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tCommon('states.loading')}
                </>
              ) : (
                toggleLabel
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
