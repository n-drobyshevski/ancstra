'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
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
import { trpc } from '@/lib/trpc/client';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';

interface Props {
  userId: string;
  userName: string;
  isCurrentlyAdmin: boolean;
  isSelf: boolean;
}

export function TogglePlatformAdmin({ userId, userName, isCurrentlyAdmin, isSelf }: Props) {
  const router = useRouter();
  const t = useTranslations('admin.togglePlatformAdmin');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const mutation = trpc.platformAdmin.togglePlatformAdmin.useMutation({
    onSuccess: () => {
      toast.success(
        isCurrentlyAdmin ? t('demoted', { name: userName }) : t('promoted', { name: userName }),
      );
      setOpen(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || t('updateFailed'));
    },
  });

  const promoting = !isCurrentlyAdmin;
  const Icon = promoting ? ShieldCheck : ShieldOff;
  const buttonLabel = promoting ? t('promote') : t('demote');

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={promoting ? 'default' : 'destructive'} size="sm">
          <Icon className="size-4" />
          {buttonLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {promoting ? t('promoteTitle') : t('demoteTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {promoting
              ? t('promoteDescription', { name: userName })
              : isSelf
                ? t('demoteSelfDescription')
                : t('demoteOtherDescription', { name: userName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>{tCommon('buttons.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate({ userId, value: promoting });
            }}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {tCommon('states.loading')}
              </>
            ) : (
              buttonLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
