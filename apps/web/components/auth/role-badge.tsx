'use client';

import { Badge } from '@/components/ui/badge';
import type { Role } from '@ancstra/auth';

const ROLE_COLORS: Record<Role, string> = {
  owner:
    'bg-[oklch(0.93_0.04_300)] text-[oklch(0.35_0.12_300)] dark:bg-[oklch(0.28_0.04_300)] dark:text-[oklch(0.75_0.10_300)]',
  admin:
    'bg-[oklch(0.93_0.04_240)] text-[oklch(0.35_0.12_240)] dark:bg-[oklch(0.28_0.04_240)] dark:text-[oklch(0.75_0.10_240)]',
  editor:
    'bg-status-success-bg text-status-success-text',
  viewer:
    'bg-status-neutral-bg text-status-neutral-text',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant="secondary" className={ROLE_COLORS[role]}>
      {role}
    </Badge>
  );
}
