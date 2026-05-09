import {
  Activity,
  CheckCircle2,
  Crown,
  FileDown,
  FileText,
  ImagePlus,
  Link2,
  Mail,
  MailX,
  Pencil,
  Settings,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

export interface ActivityActionConfig {
  icon: LucideIcon;
  /** Saturated foreground color for the icon (and the dashboard pulse dot). */
  color: string;
  /** Subtle tinted background for the activity-entry badge. */
  badgeBgClass: string;
}

/**
 * Visual config per activity action. The human-readable label is sourced from
 * the `activity.actions.<key>` translation namespace (see messages/<locale>/activity.json),
 * not from this map.
 */
export const ACTIVITY_ACTION_CONFIG: Record<string, ActivityActionConfig> = {
  person_added: {
    icon: UserPlus,
    color: 'text-status-success-text',
    badgeBgClass: 'bg-status-success-bg',
  },
  person_edited: {
    icon: Pencil,
    color: 'text-status-info-text',
    badgeBgClass: 'bg-status-info-bg',
  },
  person_deleted: {
    icon: Trash2,
    color: 'text-status-error-text',
    badgeBgClass: 'bg-status-error-bg',
  },
  relationship_added: {
    icon: Link2,
    color: 'text-status-info-text',
    badgeBgClass: 'bg-status-info-bg',
  },
  media_uploaded: {
    icon: ImagePlus,
    color: 'text-status-warning-text',
    badgeBgClass: 'bg-status-warning-bg',
  },
  gedcom_imported: {
    icon: FileDown,
    color: 'text-status-merged-text',
    badgeBgClass: 'bg-status-merged-bg',
  },
  invite_sent: {
    icon: Mail,
    color: 'text-status-info-text',
    badgeBgClass: 'bg-status-info-bg',
  },
  invite_accepted: {
    icon: UserCheck,
    color: 'text-status-success-text',
    badgeBgClass: 'bg-status-success-bg',
  },
  role_changed: {
    icon: Shield,
    color: 'text-status-warning-text',
    badgeBgClass: 'bg-status-warning-bg',
  },
  member_removed: {
    icon: UserMinus,
    color: 'text-status-error-text',
    badgeBgClass: 'bg-status-error-bg',
  },
  contribution_submitted: {
    icon: FileText,
    color: 'text-status-info-text',
    badgeBgClass: 'bg-status-info-bg',
  },
  contribution_approved: {
    icon: CheckCircle2,
    color: 'text-status-success-text',
    badgeBgClass: 'bg-status-success-bg',
  },
  contribution_rejected: {
    icon: XCircle,
    color: 'text-status-error-text',
    badgeBgClass: 'bg-status-error-bg',
  },
  owner_transferred: {
    icon: Crown,
    color: 'text-status-warning-text',
    badgeBgClass: 'bg-status-warning-bg',
  },
  invite_revoked: {
    icon: MailX,
    color: 'text-status-warning-text',
    badgeBgClass: 'bg-status-warning-bg',
  },
  family_settings_updated: {
    icon: Settings,
    color: 'text-status-neutral-text',
    badgeBgClass: 'bg-status-neutral-bg',
  },
};

export type ActivityCategoryKey =
  | 'all'
  | 'people'
  | 'media'
  | 'members'
  | 'settings'
  | 'import'
  | 'contrib';

export interface ActivityCategory {
  key: ActivityCategoryKey;
  actions: string[] | null;
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { key: 'all', actions: null },
  {
    key: 'people',
    actions: ['person_added', 'person_edited', 'person_deleted', 'relationship_added'],
  },
  {
    key: 'media',
    actions: ['media_uploaded'],
  },
  {
    key: 'members',
    actions: ['invite_sent', 'invite_accepted', 'invite_revoked', 'role_changed', 'member_removed', 'owner_transferred'],
  },
  {
    key: 'settings',
    actions: ['family_settings_updated'],
  },
  {
    key: 'import',
    actions: ['gedcom_imported'],
  },
  {
    key: 'contrib',
    actions: ['contribution_submitted', 'contribution_approved', 'contribution_rejected'],
  },
];

const FALLBACK_CONFIG: ActivityActionConfig = {
  icon: Activity,
  color: 'text-status-neutral-text',
  badgeBgClass: 'bg-status-neutral-bg',
};

export function getActionConfig(action: string): ActivityActionConfig {
  return ACTIVITY_ACTION_CONFIG[action] ?? FALLBACK_CONFIG;
}
