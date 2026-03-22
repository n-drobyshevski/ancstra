'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from './role-badge';
import { ChevronDown } from 'lucide-react';
import type { Role } from '@ancstra/auth';

interface FamilyInfo {
  id: string;
  name: string;
  role: Role;
}

export function FamilyPicker({
  families,
  activeFamilyId,
}: {
  families: FamilyInfo[];
  activeFamilyId: string;
}) {
  const router = useRouter();

  if (families.length <= 1) return null;

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          {activeFamily?.name || 'Select Family'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {families.map((family) => (
          <DropdownMenuItem
            key={family.id}
            onClick={() => router.push(`/dashboard?family=${family.id}`)}
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
