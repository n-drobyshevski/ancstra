'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Loader2, FlaskConical } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

interface ExperimentalPolicyCardProps {
  initialAllowUsers: boolean;
  lastChangedByName: string | null;
}

/**
 * Platform-wide policy: whether users may opt into experimental AI features
 * on their Labs page. Mutates the singleton platform_settings row and writes
 * to platformAuditLog. Confirmation dialog because the change is platform-wide.
 */
export function ExperimentalPolicyCard({
  initialAllowUsers,
  lastChangedByName,
}: ExperimentalPolicyCardProps) {
  const t = useTranslations('admin.experimentalPolicy');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const utils = trpc.useUtils();

  const [allowUsers, setAllowUsers] = useState(initialAllowUsers);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const mutation = trpc.platformAdmin.updateExperimentalPolicy.useMutation({
    onSuccess: (result, variables) => {
      if (result.changed) {
        setAllowUsers(variables.allowUsers);
        toast.success(t('updated'));
        utils.platformAdmin.getExperimentalPolicy.invalidate();
        router.refresh();
      }
      setConfirmOpen(false);
      setPendingValue(null);
    },
    onError: (err) => {
      toast.error(err.message || t('updateFailed'));
      setConfirmOpen(false);
      setPendingValue(null);
    },
  });

  function handleToggle(next: boolean) {
    setPendingValue(next);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (pendingValue === null) return;
    mutation.mutate({ allowUsers: pendingValue });
  }

  function handleCancel() {
    setConfirmOpen(false);
    setPendingValue(null);
  }

  const enabling = pendingValue === true;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4 text-status-warning-text" aria-hidden="true" />
            {t('cardTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('cardDescription')}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="experimental-policy-toggle" className="text-base">
                {t('toggleLabel')}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {lastChangedByName
                  ? t('lastChangedBy', { name: lastChangedByName })
                  : t('neverChanged')}
              </p>
            </div>
            <Switch
              id="experimental-policy-toggle"
              checked={allowUsers}
              onCheckedChange={handleToggle}
              disabled={mutation.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {enabling ? t('confirmEnableTitle') : t('confirmDisableTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {enabling ? t('confirmEnableBody') : t('confirmDisableBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {tCommon('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tCommon('states.loading')}
                </>
              ) : enabling ? (
                t('confirmEnableAction')
              ) : (
                t('confirmDisableAction')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
