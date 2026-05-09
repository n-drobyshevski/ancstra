'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from './role-badge';
import { ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useActiveMembership } from '@/lib/auth/use-has-permission';

export function FamilyPicker() {
  const router = useRouter();
  const t = useTranslations('navigation.header');
  const familiesQuery = trpc.family.listMine.useQuery();
  const activeMembership = useActiveMembership();

  if (familiesQuery.isLoading) return null;

  const families = familiesQuery.data ?? [];

  if (families.length <= 1) return null;

  const activeFamilyId = activeMembership?.familyId;
  const activeFamily =
    families.find((f) => f.id === activeFamilyId) ?? families[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <span className="block truncate max-w-[240px]">
            {activeFamily?.name ?? t('familyPickerFallback')}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {families.map((family) => (
          <DropdownMenuItem
            key={family.id}
            onClick={() => router.push(`?family=${family.id}`)}
            className="flex items-center justify-between gap-3"
          >
            <span>{family.name}</span>
            <RoleBadge role={family.role} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
