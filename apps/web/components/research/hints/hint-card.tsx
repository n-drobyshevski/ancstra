'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Check, X, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProviderBadge } from '@/components/research/provider-badge';
import { HintComparison } from './hint-comparison';
import type { PersonSummary, ExternalRecordData } from './hint-comparison';

export interface MatchCandidateRow {
  id: string;
  personId: string;
  sourceSystem: string;
  externalId: string;
  externalData: string; // JSON string
  matchScore: number;
  matchStatus: 'pending' | 'accepted' | 'rejected' | 'maybe';
  reviewedAt: string | null;
  createdAt: string;
}

interface HintCardProps {
  hint: MatchCandidateRow;
  localPerson: PersonSummary;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onMaybe: (id: string) => void;
}

function scoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-600 dark:text-green-400';
  if (score >= 0.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBarColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

function ScoreBreakdown({ components }: { components: Record<string, number> }) {
  return (
    <div className="space-y-1 text-xs">
      {Object.entries(components).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4">
          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          <span className="font-mono">{Math.round(value * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export function HintCard({ hint, localPerson, onAccept, onReject, onMaybe }: HintCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const parsed = JSON.parse(hint.externalData) as ExternalRecordData & {
    components?: Record<string, number>;
    url?: string;
    title?: string;
  };

  const title = parsed.title ?? `${parsed.name ?? 'Unknown'}`;
  const components = parsed.components ?? {};
  const scorePercent = Math.round(hint.matchScore * 100);

  // Keyboard shortcuts when card is focused
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target !== cardRef.current) return;
      if (e.key === 'a') { e.preventDefault(); onAccept(hint.id); }
      if (e.key === 'r') { e.preventDefault(); onReject(hint.id); }
      if (e.key === 'm') { e.preventDefault(); onMaybe(hint.id); }
    }

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [hint.id, onAccept, onReject, onMaybe]);

  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  return (
    <Card
      ref={cardRef}
      tabIndex={0}
      className="transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/50"
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ProviderBadge providerId={hint.sourceSystem} />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`text-sm font-semibold tabular-nums ${scoreColor(hint.matchScore)}`}>
                      {scorePercent}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="w-48">
                    <p className="font-medium mb-1">Score Breakdown</p>
                    <ScoreBreakdown components={components} />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm font-medium truncate">{title}</p>
            {parsed.name && parsed.name !== title && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{parsed.name}</p>
            )}
          </div>

          {/* Score bar */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreBarColor(hint.matchScore)}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
            onClick={() => onAccept(hint.id)}
          >
            <Check className="size-3.5 mr-1" />
            Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => onReject(hint.id)}
          >
            <X className="size-3.5 mr-1" />
            Reject
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-primary hover:bg-primary/10"
            onClick={() => onMaybe(hint.id)}
          >
            <HelpCircle className="size-3.5 mr-1" />
            Maybe
          </Button>

          <div className="flex-1" />

          <Button variant="ghost" size="sm" onClick={toggleExpand}>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            <span className="ml-1 text-xs">Compare</span>
          </Button>
        </div>

        {/* Expandable comparison */}
        {expanded && (
          <div className="mt-4 pt-3 border-t">
            <HintComparison
              localPerson={localPerson}
              externalRecord={parsed}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
