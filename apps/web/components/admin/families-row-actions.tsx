'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, ExternalLink, MoreHorizontal } from 'lucide-react';
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
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${family.name}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href={`/admin/families/${family.id}`}>
            <ExternalLink className="size-4" />
            Open family
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copy(family.id, 'Family ID')}>
          <Copy className="size-4" />
          Copy family ID
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copy(family.ownerEmail, 'Owner email')}>
          <Copy className="size-4" />
          Copy owner email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
