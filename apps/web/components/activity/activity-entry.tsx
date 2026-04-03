'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/format';
import { getActionConfig } from '@/lib/activity-config';

export interface ActivityEntryProps {
  userName: string;
  userAvatarUrl: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export function ActivityEntry({
  userName,
  userAvatarUrl,
  action,
  entityType,
  entityId,
  summary,
  createdAt,
}: ActivityEntryProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const timeAgo = formatRelativeTime(createdAt);
  const config = getActionConfig(action);
  const ActionIcon = config.icon;

  const isClickable = entityType === 'person' && entityId;

  const content = (
    <div className="flex min-h-[56px] items-start gap-3 rounded-lg px-2 py-3 transition-colors active:bg-muted/50 sm:hover:bg-muted/40">
      {/* Avatar with action badge */}
      <div className="relative shrink-0">
        <Avatar>
          {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-background ring-2 ring-background ${config.color}`}
        >
          <ActionIcon className="size-2.5" />
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug line-clamp-2">{summary}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {userName} &middot; {timeAgo}
        </p>
      </div>

      {/* Chevron for clickable entries */}
      {isClickable && (
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50" />
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/persons/${entityId}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
