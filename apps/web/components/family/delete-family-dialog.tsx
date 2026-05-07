'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';

interface Props {
  familyName: string;
}

export function DeleteFamilyDialog({ familyName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const deleteMut = trpc.family.delete.useMutation({
    onSuccess: () => {
      toast.success(`Deleted "${familyName}"`);
      setOpen(false);
      // Membership is gone — bounce to root and let auth resolve a new
      // active family (or an empty state).
      router.push('/');
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete family');
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) setTyped('');
    setOpen(next);
  }

  const enabled = typed.trim() === familyName && !deleteMut.isPending;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="size-4" />
          Delete family
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{familyName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes all members, invitations, and activity
            for this family from the platform. The family tree storage will
            be orphaned and is not automatically recovered.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete-family">
            Type the family name <strong>{familyName}</strong> to confirm
          </Label>
          <Input
            id="confirm-delete-family"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={familyName}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!enabled}
            onClick={(e) => {
              e.preventDefault();
              deleteMut.mutate({ confirmName: typed });
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete family'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
