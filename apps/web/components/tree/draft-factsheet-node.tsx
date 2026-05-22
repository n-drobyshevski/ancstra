'use client';

import { useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Loader2, X, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { cn } from '@/lib/utils';
import {
  useFactsheetDetail,
  useFactsheetDuplicates,
  promoteFactsheet,
  type DuplicateMatch,
} from '@/lib/research/factsheet-client';

interface DraftFactsheetNodeData {
  factsheetId: string;
  onPromoted: () => void;
  onCancel: () => void;
  [key: string]: unknown;
}

export function DraftFactsheetNode({ data }: { data: DraftFactsheetNodeData }) {
  const { factsheetId, onPromoted, onCancel } = data;
  const t = useTranslations('tree.draftFactsheet');
  const tHandles = useTranslations('tree.node.handles');
  const { detail, isLoading } = useFactsheetDetail(factsheetId);
  const { matches, isLoading: dupsLoading } = useFactsheetDuplicates(factsheetId, true);
  const [promoting, setPromoting] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<DuplicateMatch | null>(null);

  // Escape key cancels
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handlePromote = useCallback(async (mode: 'create' | 'merge') => {
    setPromoting(true);
    try {
      const hasLinks = (detail?.links.length ?? 0) > 0;
      await promoteFactsheet(
        factsheetId,
        mode,
        mode === 'merge' ? selectedMatch?.personId : undefined,
        hasLinks,
      );
      toast.success(hasLinks ? t('familyPromoted') : t('personCreated'));
      onPromoted();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('promotionFailed'));
    } finally {
      setPromoting(false);
    }
  }, [factsheetId, detail, selectedMatch, onPromoted, t]);

  if (isLoading || !detail) {
    return (
      <div className="w-[240px] rounded-lg border bg-card p-4 shadow-md flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  const statusCfg = FACTSHEET_STATUS_CONFIG[detail.status] ?? FACTSHEET_STATUS_CONFIG.draft;
  const keyFacts = detail.facts.slice(0, 3);
  const hasLinks = detail.links.length > 0;
  const topMatch = matches[0];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="target" position={Position.Top} className="!bg-primary" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{tHandles('parents')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Handle type="source" position={Position.Bottom} className="!bg-primary" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{tHandles('children')}</TooltipContent>
      </Tooltip>

      <div className="w-[240px] rounded-lg border-2 border-dashed border-primary/40 bg-card p-3 shadow-md space-y-2.5 nowheel">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{detail.title}</p>
            <p className="text-[10px] text-muted-foreground">
              {t('factsCount', { count: detail.facts.length })}
              {hasLinks && ` · ${t('linksCount', { count: detail.links.length })}`}
            </p>
          </div>
          <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium', statusCfg.className)}>
            {statusCfg.label}
          </span>
        </div>

        {/* Key facts preview */}
        {keyFacts.length > 0 && (
          <div className="space-y-0.5">
            {keyFacts.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground uppercase w-16 shrink-0 truncate">
                  {f.factType.replace(/_/g, ' ')}
                </span>
                <span className="truncate">{f.factValue}</span>
              </div>
            ))}
          </div>
        )}

        {/* Family unit indicator */}
        {hasLinks && (
          <div className="flex items-center gap-1.5 text-[10px] text-primary">
            <Users className="size-3" />
            {t('partOfFamily', { count: detail.links.length })}
          </div>
        )}

        {/* Duplicate warning */}
        {dupsLoading && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t('checkingDuplicates')}
          </div>
        )}
        {!dupsLoading && topMatch && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[10px]">
            <p className="text-amber-500 font-medium mb-1">
              {t('possibleMatch', {
                name: `${topMatch.givenName} ${topMatch.surname}`,
                score: Math.round(topMatch.score * 100),
              })}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] w-full"
              disabled={promoting}
              onClick={() => { setSelectedMatch(topMatch); handlePromote('merge'); }}
            >
              {t('mergeIntoThis')}
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
            disabled={promoting}
            onClick={() => handlePromote('create')}
          >
            {promoting ? (
              <><Loader2 className="mr-1 size-3 animate-spin" />{t('promoting')}</>
            ) : hasLinks ? (
              t('promoteFamily')
            ) : (
              t('createPerson')
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onCancel}
            aria-label={t('cancelAriaLabel')}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
