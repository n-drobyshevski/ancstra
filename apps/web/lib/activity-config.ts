import {
  Activity,
  CheckCircle2,
  Crown,
  FileDown,
  FileText,
  ImagePlus,
  Link2,
  Mail,
  Pencil,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

export const ACTIVITY_ACTION_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  person_added: {
    icon: UserPlus,
    color: 'text-emerald-600',
    label: 'Person added',
  },
  person_edited: {
    icon: Pencil,
    color: 'text-blue-600',
    label: 'Person edited',
  },
  person_deleted: {
    icon: Trash2,
    color: 'text-destructive',
    label: 'Person deleted',
  },
  relationship_added: {
    icon: Link2,
    color: 'text-violet-600',
    label: 'Relationship added',
  },
  media_uploaded: {
    icon: ImagePlus,
    color: 'text-amber-600',
    label: 'Media uploaded',
  },
  gedcom_imported: {
    icon: FileDown,
    color: 'text-primary',
    label: 'GEDCOM imported',
  },
  invite_sent: {
    icon: Mail,
    color: 'text-sky-600',
    label: 'Invite sent',
  },
  invite_accepted: {
    icon: UserCheck,
    color: 'text-emerald-600',
    label: 'Invite accepted',
  },
  role_changed: {
    icon: Shield,
    color: 'text-orange-600',
    label: 'Role changed',
  },
  member_removed: {
    icon: UserMinus,
    color: 'text-destructive',
    label: 'Member removed',
  },
  contribution_submitted: {
    icon: FileText,
    color: 'text-blue-600',
    label: 'Contribution submitted',
  },
  contribution_approved: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    label: 'Contribution approved',
  },
  contribution_rejected: {
    icon: XCircle,
    color: 'text-destructive',
    label: 'Contribution rejected',
  },
  owner_transferred: {
    icon: Crown,
    color: 'text-amber-600',
    label: 'Ownership transferred',
  },
};

export type ActivityCategoryKey =
  | 'all'
  | 'people'
  | 'media'
  | 'members'
  | 'import'
  | 'contrib';

export interface ActivityCategory {
  key: ActivityCategoryKey;
  label: string;
  actions: string[] | null;
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { key: 'all', label: 'All', actions: null },
  {
    key: 'people',
    label: 'People',
    actions: ['person_added', 'person_edited', 'person_deleted', 'relationship_added'],
  },
  {
    key: 'media',
    label: 'Media',
    actions: ['media_uploaded'],
  },
  {
    key: 'members',
    label: 'Members',
    actions: ['invite_sent', 'invite_accepted', 'role_changed', 'member_removed', 'owner_transferred'],
  },
  {
    key: 'import',
    label: 'Import',
    actions: ['gedcom_imported'],
  },
  {
    key: 'contrib',
    label: 'Contributions',
    actions: ['contribution_submitted', 'contribution_approved', 'contribution_rejected'],
  },
];

const FALLBACK_CONFIG: { icon: LucideIcon; color: string; label: string } = {
  icon: Activity,
  color: 'text-muted-foreground',
  label: 'Activity',
};

export function getActionConfig(action: string): {
  icon: LucideIcon;
  color: string;
  label: string;
} {
  return ACTIVITY_ACTION_CONFIG[action] ?? FALLBACK_CONFIG;
}
