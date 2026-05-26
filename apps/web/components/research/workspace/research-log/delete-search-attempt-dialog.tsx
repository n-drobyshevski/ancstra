'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { useSearchAttemptMutations } from '@/hooks/use-search-attempt-mutations';
import type { SearchAttempt } from '@/hooks/use-search-attempts';

/**
 * Bundle E 2026-05-26 — Delete confirmation dialog for a single search attempt.
 *
 * Uses shadcn AlertDialog with destructive styling. Disables Confirm while the
 * DELETE request is in-flight (prevents double-submit). On success calls
 * onDeleted(id) so the parent can refetch the list.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.
 */

interface DeleteSearchAttemptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attempt: SearchAttempt | null;
  onDeleted: (attemptId: string) => void;
}

export function DeleteSearchAttemptDialog({
  open,
  onOpenChange,
  attempt,
  onDeleted,
}: DeleteSearchAttemptDialogProps) {
  const t = useTranslations('persons.researchLog');
  const { remove, isDeleting } = useSearchAttemptMutations(attempt?.personId ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!attempt) return;
    setError(null);
    const result = await remove(attempt.id);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    onDeleted(attempt.id);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteConfirmBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t('form.cancelLabel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('deleteAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
