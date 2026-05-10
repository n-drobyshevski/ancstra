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
  Trash2,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  family: {
    id: string;
    name: string;
    ownerEmail: string;
  };
}

export function FamiliesRowActions({ family }: Props) {
  const router = useRouter();
  const t = useTranslations('admin.families.rowActions');
  const tCommon = useTranslations('common');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const deleteMutation = trpc.platformAdmin.deleteFamily.useMutation({
    onSuccess: () => {
      toast.success(t('deleteSuccess', { name: family.name }));
      setConfirmOpen(false);
      setConfirmName('');
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || t('deleteFailed'));
    },
  });

  async function copy(value: string, kind: 'idCopied' | 'ownerCopied') {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t(kind));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  const isPending = deleteMutation.isPending;
  const confirmMatches = confirmName.trim() === family.name;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('ariaLabel', { name: family.name })}
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
            <Link href={`/admin/families/${family.id}`}>
              <ExternalLink className="size-4" />
              {t('open')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => copy(family.id, 'idCopied')}>
            <Copy className="size-4" />
            {t('copyId')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copy(family.ownerEmail, 'ownerCopied')}>
            <Copy className="size-4" />
            {t('copyOwnerEmail')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isPending) {
            setConfirmOpen(open);
            if (!open) setConfirmName('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialogDescription', { name: family.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`confirm-${family.id}`}>
              {t('deleteConfirmLabel', { name: family.name })}
            </Label>
            <Input
              id={`confirm-${family.id}`}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={family.name}
              autoComplete="off"
              disabled={isPending}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {tCommon('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmMatches || isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate({
                  familyId: family.id,
                  confirmName: confirmName.trim(),
                });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tCommon('states.loading')}
                </>
              ) : (
                t('deleteAction')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
