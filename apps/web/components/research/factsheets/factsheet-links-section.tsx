'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { fetchLinkSuggestions } from '@/lib/research/factsheet-client';
import { classifyApiError } from '@/lib/api/classify-error';
import type {
  FactsheetLink,
  Factsheet,
  FactsheetLinkSuggestion,
} from '@/lib/research/factsheet-client';

interface FactsheetLinksSectionProps {
  factsheetId: string;
  links: FactsheetLink[];
  allFactsheets: Factsheet[];
  onLinkClick: (factsheetId: string) => void;
  onCreateLink: () => void;
  onLinkCreated?: () => void;
}

function suggestionKey(s: FactsheetLinkSuggestion): string {
  return `${s.factId}|${s.relationshipType}|${s.suggestedFactsheetId}`;
}

/**
 * Translate a suggestion into the directional payload the API expects.
 * For parent_name the other factsheet is the parent; for child_name the
 * current factsheet is the parent. Spouse/sibling are symmetric.
 */
function suggestionToPayload(
  currentId: string,
  s: FactsheetLinkSuggestion,
): { fromId: string; toId: string } {
  if (s.factType === 'parent_name') {
    return { fromId: s.suggestedFactsheetId, toId: currentId };
  }
  return { fromId: currentId, toId: s.suggestedFactsheetId };
}

export function FactsheetLinksSection({
  factsheetId, links, allFactsheets, onLinkClick, onCreateLink, onLinkCreated,
}: FactsheetLinksSectionProps) {
  const [suggestions, setSuggestions] = useState<FactsheetLinkSuggestion[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(links.length === 0);

  useEffect(() => {
    let cancelled = false;
    fetchLinkSuggestions(factsheetId)
      .then((data) => {
        if (!cancelled) setSuggestions(data.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => { cancelled = true; };
  }, [factsheetId]);

  const fsMap = useMemo(
    () => new Map(allFactsheets.map((f) => [f.id, f])),
    [allFactsheets],
  );

  function getLinkedFactsheet(link: FactsheetLink): Factsheet | undefined {
    const otherId = link.fromFactsheetId === factsheetId ? link.toFactsheetId : link.fromFactsheetId;
    return fsMap.get(otherId);
  }

  const visibleSuggestions = useMemo(() => {
    // Treat any existing link between the pair as already-handled, regardless of stored type.
    const linkedPartnerIds = new Set<string>();
    for (const link of links) {
      const otherId = link.fromFactsheetId === factsheetId ? link.toFactsheetId : link.fromFactsheetId;
      linkedPartnerIds.add(otherId);
    }
    return suggestions.filter((s) => {
      if (dismissedKeys.has(suggestionKey(s))) return false;
      if (linkedPartnerIds.has(s.suggestedFactsheetId)) return false;
      return true;
    });
  }, [suggestions, dismissedKeys, links, factsheetId]);

  const handleAccept = useCallback(
    async (s: FactsheetLinkSuggestion) => {
      const key = suggestionKey(s);
      setAcceptingKey(key);
      try {
        const { fromId, toId } = suggestionToPayload(factsheetId, s);
        const res = await fetch(`/api/research/factsheets/${fromId}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toFactsheetId: toId,
            relationshipType: s.relationshipType,
            sourceFactId: s.factId,
          }),
        });
        if (!res.ok) {
          toast.error(classifyApiError(res));
          return;
        }
        toast.success(`Linked ${s.suggestedFactsheetTitle}`);
        setSuggestions((prev) => prev.filter((p) => suggestionKey(p) !== key));
        onLinkCreated?.();
      } catch {
        toast.error('Network error — check your connection');
      } finally {
        setAcceptingKey(null);
      }
    },
    [factsheetId, onLinkCreated],
  );

  const handleReject = useCallback((s: FactsheetLinkSuggestion) => {
    setDismissedKeys((prev) => {
      const next = new Set(prev);
      next.add(suggestionKey(s));
      return next;
    });
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Linked Factsheets ({links.length})
        </h4>
        <button
          type="button"
          className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          onClick={onCreateLink}
        >
          + Link
        </button>
      </div>

      {links.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          No linked factsheets. Relationship facts can suggest links.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const linked = getLinkedFactsheet(link);
            if (!linked) return null;
            const statusCfg = FACTSHEET_STATUS_CONFIG[linked.status];

            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onLinkClick(linked.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">{linked.title}</span>
                {statusCfg && (
                  <span className={cn('rounded px-1 py-0.5 text-[9px]', statusCfg.className)}>
                    {statusCfg.label.toLowerCase()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {visibleSuggestions.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            Suggestions ({visibleSuggestions.length})
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1.5">
              {visibleSuggestions.map((s) => {
                const key = suggestionKey(s);
                const isAccepting = acceptingKey === key;
                return (
                  <li
                    key={key}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.suggestedFactsheetTitle}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        “{s.factValue}” via {s.factType.replace('_', ' ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAccept(s)}
                      disabled={isAccepting || acceptingKey !== null}
                      className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {isAccepting ? <Loader2 className="size-3 animate-spin" /> : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(s)}
                      disabled={acceptingKey !== null}
                      className="rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {expanded && (
            <p className="mt-1.5 text-[10px] text-muted-foreground/80">
              Dismissed suggestions reappear on reload — accept to keep changes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
