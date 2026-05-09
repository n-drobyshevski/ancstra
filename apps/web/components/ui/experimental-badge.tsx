'use client';

import { FlaskConical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ExperimentalBadgeProps {
  className?: string;
  /** Render without the surrounding tooltip — use when the parent already has one. */
  withoutTooltip?: boolean;
}

/**
 * Inline marker for experimental features. Pair with a feature title so the
 * "this may change or break" social contract is always visible alongside the
 * affordance. Uses the amber warning palette from globals.css.
 */
export function ExperimentalBadge({ className, withoutTooltip = false }: ExperimentalBadgeProps) {
  const t = useTranslations('common.experimentalBadge');
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'bg-status-warning-bg text-status-warning-text border-status-warning-text/20',
        className,
      )}
    >
      <FlaskConical aria-hidden="true" />
      {t('label')}
    </Badge>
  );
  if (withoutTooltip) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{t('tooltip')}</TooltipContent>
    </Tooltip>
  );
}
