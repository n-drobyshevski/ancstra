'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isSelf = user.id === currentUserId;
  const promoting = !user.isPlatformAdmin;

  const toggle = trpc.platformAdmin.togglePlatformAdmin.useMutation({
    onSuccess: () => {
      toast.success(promoting ? `Promoted ${user.name}` : `Demoted ${user.name}`);
      setConfirmOpen(false);
      router.refresh();
    },
    onError: (err) =>
      toast.error(err.message || 'Failed to update platform admin status'),
  });

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }

  const isPending = toggle.isPending;
  const ToggleIcon = promoting ? ShieldCheck : ShieldOff;
  const toggleLabel = promoting ? 'Promote to admin' : 'Demote from admin';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${user.name}`}
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
              Open user
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
          <DropdownMenuItem onClick={() => copy(user.id, 'User ID')}>
            <Copy className="size-4" />
            Copy user ID
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copy(user.email, 'Email')}>
            <Copy className="size-4" />
            Copy email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {promoting
                ? 'Grant platform admin access?'
                : 'Revoke platform admin access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {promoting
                ? `${user.name} will gain access to the /admin console and be able to view all users and families across the platform.`
                : isSelf
                  ? `You'll lose access to /admin immediately after this. Make sure another platform admin exists first.`
                  : `${user.name} will no longer be able to access the /admin console.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggle.isPending}>
              Cancel
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
                  Saving…
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
