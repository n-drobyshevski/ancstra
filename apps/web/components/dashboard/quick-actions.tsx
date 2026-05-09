'use client';

import Link from 'next/link';
import { UserPlus, Upload, Sparkles, GitBranch, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { hasPermission } from '@ancstra/auth/permissions';
import type { Permission } from '@ancstra/auth';
import { useEffectiveMembership } from '@/lib/auth/use-has-permission';

type ActionKey = 'addPerson' | 'importData' | 'aiResearch' | 'viewTree';

interface Action {
  key: ActionKey;
  icon: LucideIcon;
  href: string;
  permission: Permission;
}

const actions: Action[] = [
  { key: 'addPerson', icon: UserPlus, href: '/persons/new', permission: 'person:create' },
  { key: 'importData', icon: Upload, href: '/data', permission: 'gedcom:import' },
  { key: 'aiResearch', icon: Sparkles, href: '/research', permission: 'ai:research' },
  { key: 'viewTree', icon: GitBranch, href: '/tree', permission: 'tree:view' },
];

/**
 * Resolves visibility off the effective (lens-aware) membership in a single
 * hook call, then filters synchronously. Hides the whole grid when no action
 * is available to keep the dashboard layout clean under a viewer lens.
 */
export function QuickActions() {
  const membership = useEffectiveMembership();
  const t = useTranslations('dashboard.quickActions');
  const visible = membership
    ? actions.filter((a) => hasPermission(membership.role, a.permission))
    : [];
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {visible.map(({ key, icon: Icon, href }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted/50 transition-colors"
        >
          <Icon className="size-5 text-primary" />
          <span className="text-sm font-medium">{t(key)}</span>
        </Link>
      ))}
    </div>
  );
}
