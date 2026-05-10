'use client';

import type { Role } from '@ancstra/auth';
import { formatDistanceToNow } from 'date-fns';
import { Crown, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DataCard,
  DataCardActions,
  DataCardBody,
  DataCardLeading,
  DataCardMeta,
  DataCardSubtitle,
  DataCardTitle,
} from '@/components/ui/data-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from '@/components/auth/role-badge';
import { RoleGate } from '@/components/auth/role-gate';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  lastSeenAt: string | null;
  name: string | null;
  email: string;
}

const ASSIGNABLE_ROLES = ['admin', 'editor', 'viewer'] as const;
const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

function classifyActivity(lastSeenAt: string | null): 'active' | 'inactive' | 'never' {
  if (!lastSeenAt) return 'never';
  try {
    const ms = Date.now() - new Date(lastSeenAt).getTime();
    return ms > STALE_THRESHOLD_MS ? 'inactive' : 'active';
  } catch {
    return 'never';
  }
}

function initialsOf(member: Member): string {
  const source = member.name?.trim() || member.email;
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatLastSeen(value: string | null): string {
  if (!value) return '—';
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return '—';
  }
}

interface MemberMobileCardProps {
  member: Member;
  isYou: boolean;
  selected: boolean;
  bulkBusy: boolean;
  showCheckbox: boolean;
  isSelectable: boolean;
  showRoleEditor: boolean;
  showMenu: boolean;
  showTransfer: boolean;
  showRemove: boolean;
  updatingRole: boolean;
  removingMember: boolean;
  onToggleSelect: (id: string, selected: boolean) => void;
  onRoleChange: (userId: string, role: string) => void;
  onTransfer: (member: Member) => void;
  onRemove: (member: Member) => void;
}

export function MemberMobileCard({
  member,
  isYou,
  selected,
  bulkBusy,
  showCheckbox,
  isSelectable,
  showRoleEditor,
  showMenu,
  showTransfer,
  showRemove,
  updatingRole,
  removingMember,
  onToggleSelect,
  onRoleChange,
  onTransfer,
  onRemove,
}: MemberMobileCardProps) {
  const activity = classifyActivity(member.lastSeenAt);
  const displayName = member.name ?? 'Unknown';

  return (
    <DataCard selected={selected}>
      {showCheckbox ? (
        <DataCardLeading>
          <div className="flex min-h-11 min-w-11 items-center justify-center">
            <Checkbox
              aria-label={`Select ${displayName}`}
              checked={selected}
              disabled={!isSelectable || bulkBusy}
              onCheckedChange={(value) => onToggleSelect(member.userId, !!value)}
            />
          </div>
        </DataCardLeading>
      ) : (
        <DataCardLeading>
          <Avatar className="size-9">
            <AvatarFallback className="text-xs">{initialsOf(member)}</AvatarFallback>
          </Avatar>
        </DataCardLeading>
      )}

      <DataCardBody>
        <DataCardTitle>
          <span>{displayName}</span>
          {isYou ? (
            <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
          ) : null}
        </DataCardTitle>
        <DataCardSubtitle>{member.email}</DataCardSubtitle>
        <DataCardMeta>
          {showRoleEditor ? (
            <RoleGate
              permission="members:manage"
              fallback={<RoleBadge role={member.role} />}
            >
              <Select
                value={member.role}
                onValueChange={(value) => onRoleChange(member.userId, value)}
                disabled={updatingRole}
              >
                <SelectTrigger className="h-8 w-[120px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </RoleGate>
          ) : (
            <RoleBadge role={member.role} />
          )}
          <span className="text-xs">
            Joined {new Date(member.joinedAt).toLocaleDateString()}
          </span>
          <span className="text-xs">{formatLastSeen(member.lastSeenAt)}</span>
          {activity === 'inactive' ? (
            <Badge variant="outline" className="h-5 text-[0.7rem]">
              Inactive
            </Badge>
          ) : null}
        </DataCardMeta>
      </DataCardBody>

      {showMenu ? (
        <DataCardActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Member actions"
                disabled={removingMember}
              >
                {removingMember ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showTransfer ? (
                <RoleGate permission="members:transfer-ownership">
                  <DropdownMenuItem onClick={() => onTransfer(member)}>
                    <Crown className="size-4 mr-2" />
                    Transfer ownership
                  </DropdownMenuItem>
                </RoleGate>
              ) : null}
              {showTransfer && showRemove ? <DropdownMenuSeparator /> : null}
              {showRemove ? (
                <RoleGate permission="members:manage">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onRemove(member)}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Remove member
                  </DropdownMenuItem>
                </RoleGate>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </DataCardActions>
      ) : null}
    </DataCard>
  );
}
