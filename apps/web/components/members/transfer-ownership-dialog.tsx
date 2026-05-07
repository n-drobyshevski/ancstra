'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Role } from '@ancstra/auth';

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  name: string | null;
  email: string;
  lastSeenAt: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  familyId: string;
  familyName: string;
  onTransferred: () => void;
}

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  member,
  familyId,
  familyName,
  onTransferred,
}: Props) {
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const enabled = typed.trim() === familyName && !submitting;
  const memberLabel = member.name ?? member.email;

  async function handleConfirm(e: React.MouseEvent) {
    // Prevent Radix's built-in close-on-action; we control close manually
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/families/${familyId}/members/${member.userId}/transfer-ownership`,
        { method: 'POST' }
      );

      if (res.status === 200) {
        toast.success(`Ownership transferred to ${memberLabel}`);
        onTransferred();
        onOpenChange(false);
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.code === 'CONCURRENT_TRANSFER') {
        toast.error('Concurrent transfer detected. Please retry.');
        return;
      }
      toast.error(body.error ?? 'Failed to transfer ownership');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) setTyped('');
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transfer ownership to {memberLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be demoted to admin and lose owner-only permissions
            (deleting the tree, managing family settings). This cannot be
            undone except by the new owner transferring back to you.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-family-name">
            Type the family name <strong>{familyName}</strong> to confirm
          </Label>
          <Input
            id="confirm-family-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            placeholder={familyName}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!enabled}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
            Transfer ownership
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
