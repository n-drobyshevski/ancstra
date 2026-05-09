'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, ExternalLink, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  family: {
    id: string;
    name: string;
    ownerEmail: string;
  };
}

export function FamiliesRowActions({ family }: Props) {
  const t = useTranslations('admin.families.rowActions');

  async function copy(value: string, kind: 'idCopied' | 'ownerCopied') {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t(kind));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('ariaLabel', { name: family.name })}
        >
          <MoreHorizontal className="size-4" />
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
