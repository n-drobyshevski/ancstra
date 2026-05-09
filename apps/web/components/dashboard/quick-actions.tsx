'use client';

import Link from 'next/link';
import {
  UserPlus,
  Upload,
  Sparkles,
  GitBranch,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { hasPermission } from '@ancstra/auth/permissions';
import { useEffectiveMembership } from '@/lib/auth/use-has-permission';
import {
  selectQuickActionKeys,
  QUICK_ACTION_PERMISSIONS,
  type QuickActionKey,
} from '@/lib/dashboard/quick-actions';

interface ActionDef {
  icon: LucideIcon;
  href: string;
}

const ACTION_DEFS: Record<QuickActionKey, ActionDef> = {
  addPerson: { icon: UserPlus, href: '/persons/new' },
  importData: { icon: Upload, href: '/data' },
  aiResearch: { icon: Sparkles, href: '/research' },
  viewTree: { icon: GitBranch, href: '/tree' },
  inviteMember: { icon: Mail, href: '/settings/members' },
};

/**
 * Per-role quick-action grid. Decision flow:
 *   1. `selectQuickActionKeys(role)` returns the role's ordered, capped (≤4)
 *      eligible action set.
 *   2. We filter out any action whose permission the effective membership
 *      doesn't carry — server-enforced, this is affordance hiding only.
 *   3. If nothing remains, the grid hides itself entirely (viewer's case).
 *
 * Lens-aware via `useEffectiveMembership`: switching to a viewer lens
 * collapses the grid; switching to an admin lens reveals "Invite member".
 */
export function QuickActions() {
  const membership = useEffectiveMembership();
  const t = useTranslations('dashboard.quickActions');

  const orderedKeys = membership ? selectQuickActionKeys(membership.role) : [];
  const visible = orderedKeys.filter((key) =>
    membership ? hasPermission(membership.role, QUICK_ACTION_PERMISSIONS[key]) : false,
  );
  if (visible.length === 0) return null;

  // Match grid columns to count so 3 actions don't stretch awkwardly to 4 cols.
  const gridCols =
    visible.length === 1
      ? 'sm:grid-cols-1'
      : visible.length === 2
        ? 'sm:grid-cols-2'
        : visible.length === 3
          ? 'sm:grid-cols-3'
          : 'sm:grid-cols-4';

  return (
    <div className={`grid grid-cols-2 gap-3 ${gridCols}`}>
      {visible.map((key) => {
        const { icon: Icon, href } = ACTION_DEFS[key];
        return (
          <Link
            key={key}
            href={href}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted/50 transition-colors"
          >
            <Icon className="size-5 text-primary" />
            <span className="text-sm font-medium">{t(key)}</span>
          </Link>
        );
      })}
    </div>
  );
}
