'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFormatRelativeTime } from '@/lib/format-client';
import { getActionConfig, ACTIVITY_ACTION_CONFIG } from '@/lib/activity-config';
import { ActivityMetadataReveal } from './activity-metadata-reveal';

export interface ActivityEntryProps {
  userName: string;
  userAvatarUrl: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

const ROLE_PARAM_KEYS = ['role', 'newRole', 'oldRole', 'previousRole'] as const;

// Some action templates need to vary on metadata presence (e.g. invite_sent
// reads differently when no email was supplied). Centralised here so the
// renderer stays declarative.
function pickSummaryKey(
  action: string,
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (metadata?.redacted === true) return 'redacted';
  if (action === 'invite_sent' && (!metadata || !metadata.email)) {
    return 'invite_sent_no_email';
  }
  return action;
}

export function ActivityEntry({
  userName,
  userAvatarUrl,
  action,
  entityType,
  entityId,
  summary,
  createdAt,
  metadata,
}: ActivityEntryProps) {
  const formatRelative = useFormatRelativeTime();
  const tActions = useTranslations('activity.actions');
  const tSummaries = useTranslations('activity.summaries');
  const tRoles = useTranslations('common.lens.roles');
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const timeAgo = formatRelative(createdAt);
  const config = getActionConfig(action);
  const ActionIcon = config.icon;
  // Narrow the dynamic action string into the literal union next-intl wants.
  type ActionKey = Parameters<typeof tActions>[0];
  const actionLabel = action in ACTIVITY_ACTION_CONFIG
    ? tActions(action as ActionKey)
    : tActions('fallback');

  // Translate the human-readable summary line. Falls back to the server-stored
  // English `summary` when the action has no template, ICU args are missing,
  // or next-intl throws — keeping older feed rows readable while newly logged
  // actions render in the active locale.
  type SumKey = Parameters<typeof tSummaries.has>[0];
  type RoleKey = Parameters<typeof tRoles.has>[0];
  let renderedSummary = summary;
  const summaryKey = pickSummaryKey(action, metadata);
  if (tSummaries.has(summaryKey as SumKey)) {
    try {
      const params: Record<string, unknown> = { ...(metadata ?? {}) };
      for (const k of ROLE_PARAM_KEYS) {
        const v = params[k];
        if (typeof v === 'string') {
          const lowered = v.toLowerCase() as RoleKey;
          if (tRoles.has(lowered)) params[k] = tRoles(lowered);
        }
      }
      renderedSummary = tSummaries(
        summaryKey as SumKey,
        params as Parameters<typeof tSummaries>[1],
      );
    } catch {
      // ICU param mismatch / formatter error — keep the English fallback.
    }
  }

  const isClickable = entityType === 'person' && entityId;
  const hasMetadata = metadata && Object.keys(metadata).length > 0;

  const inner = (
    <div className="flex min-h-[56px] items-start gap-3 rounded-lg px-2 py-3 transition-colors active:bg-muted/50 sm:hover:bg-muted/40">
      <div className="relative shrink-0">
        <Avatar>
          {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full ring-2 ring-background ${config.badgeBgClass} ${config.color}`}
          aria-hidden
        >
          <ActionIcon className="size-2.5" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug line-clamp-2">{renderedSummary}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{userName}</span>
          {' · '}
          <span className="text-muted-foreground">{actionLabel}</span>
          {' · '}
          <time dateTime={createdAt}>{timeAgo}</time>
        </p>
        {hasMetadata ? (
          <ActivityMetadataReveal metadata={metadata as Record<string, unknown>} />
        ) : null}
      </div>

      {isClickable && (
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50" />
      )}
    </div>
  );

  if (isClickable) {
    return (
      <Link href={`/persons/${entityId}`} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
