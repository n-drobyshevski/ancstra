'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Best-effort count to display. Final server-side count may differ. */
  count: number;
  /** When true, force the user to type the count before the destructive action enables. */
  requireCountEcho: boolean;
  /** Disabled while the request is in flight. */
  isPending: boolean;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  count,
  requireCountEcho,
  isPending,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const t = useTranslations('persons.deleteDialog');
  const [echo, setEcho] = useState('');

  const echoMatches = echo.trim() === String(count);
  const canConfirm = !isPending && (!requireCountEcho || echoMatches);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setEcho('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" aria-hidden />
            </div>
            <AlertDialogTitle>
              {t('title', { count })}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {t('description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireCountEcho && (
          <div className="space-y-2 py-2">
            <label htmlFor="delete-confirm-count" className="text-sm font-medium">
              {t.rich('echoPrompt', {
                count,
                code: (chunks) => <span className="tabular-nums">{chunks}</span>,
              })}
            </label>
            <Input
              id="delete-confirm-count"
              type="number"
              inputMode="numeric"
              value={echo}
              onChange={(e) => setEcho(e.target.value)}
              placeholder={String(count)}
              autoFocus
              disabled={isPending}
              className="tabular-nums"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={isPending}>{t('cancel')}</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              disabled={!canConfirm}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {isPending ? t('deleting') : t('delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
