'use client';

import Link from 'next/link';
import { UserPlus, Upload, Sparkles, GitBranch, type LucideIcon } from 'lucide-react';
import { hasPermission } from '@ancstra/auth/permissions';
import type { Permission } from '@ancstra/auth';
import { useEffectiveMembership } from '@/lib/auth/use-has-permission';

interface Action {
  label: string;
  icon: LucideIcon;
  href: string;
  permission: Permission;
}

const actions: Action[] = [
  { label: 'Add Person', icon: UserPlus, href: '/persons/new', permission: 'person:create' },
  { label: 'Import Data', icon: Upload, href: '/data', permission: 'gedcom:import' },
  { label: 'AI Research', icon: Sparkles, href: '/research', permission: 'ai:research' },
  { label: 'View Tree', icon: GitBranch, href: '/tree', permission: 'tree:view' },
];

/**
 * Resolves visibility off the effective (lens-aware) membership in a single
 * hook call, then filters synchronously. Hides the whole grid when no action
 * is available to keep the dashboard layout clean under a viewer lens.
 */
export function QuickActions() {
  const membership = useEffectiveMembership();
  const visible = membership
    ? actions.filter((a) => hasPermission(membership.role, a.permission))
    : [];
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {visible.map(({ label, icon: Icon, href }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted/50 transition-colors"
        >
          <Icon className="size-5 text-primary" />
          <span className="text-sm font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
}
