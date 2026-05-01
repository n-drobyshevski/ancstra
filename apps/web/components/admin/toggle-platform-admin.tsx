'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
  const [open, setOpen] = useState(false);
  const mutation = trpc.platformAdmin.togglePlatformAdmin.useMutation({
    onSuccess: () => {
      toast.success(
        isCurrentlyAdmin ? `Demoted ${userName}` : `Promoted ${userName}`,
      );
      setOpen(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update platform admin status');
    },
  });

  const promoting = !isCurrentlyAdmin;
  const Icon = promoting ? ShieldCheck : ShieldOff;
  const buttonLabel = promoting ? 'Promote to admin' : 'Demote from admin';

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
            {promoting ? 'Grant platform admin access?' : 'Revoke platform admin access?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {promoting
              ? `${userName} will gain access to the /admin console and be able to view all users and families across the platform.`
              : isSelf
                ? `You'll lose access to /admin immediately after this. Make sure another platform admin exists first.`
                : `${userName} will no longer be able to access the /admin console.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
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
                Saving…
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
