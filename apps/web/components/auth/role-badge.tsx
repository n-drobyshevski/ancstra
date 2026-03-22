'use client';

import { Badge } from '@/components/ui/badge';
import type { Role } from '@ancstra/auth';

const ROLE_COLORS: Record<Role, string> = {
  owner:
    'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  editor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant="secondary" className={ROLE_COLORS[role]}>
      {role}
    </Badge>
  );
}
