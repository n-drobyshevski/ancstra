'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RELATIONSHIP_TYPE_LABELS, FACTSHEET_STATUS_CONFIG } from '@/lib/research/constants';
import { fetchLinkSuggestions } from '@/lib/research/factsheet-client';
import type { FactsheetLink, Factsheet } from '@/lib/research/factsheet-client';

interface FactsheetLinksSectionProps {
  factsheetId: string;
  links: FactsheetLink[];
  allFactsheets: Factsheet[];
  onLinkClick: (factsheetId: string) => void;
  onCreateLink: () => void;
}

export function FactsheetLinksSection({
  factsheetId, links, allFactsheets, onLinkClick, onCreateLink,
}: FactsheetLinksSectionProps) {
  const [suggestionCount, setSuggestionCount] = useState(0);

  useEffect(() => {
    fetchLinkSuggestions(factsheetId)
      .then((data) => setSuggestionCount(data.suggestions.length))
      .catch(() => setSuggestionCount(0));
  }, [factsheetId]);

  const fsMap = new Map(allFactsheets.map((f) => [f.id, f]));

  function getLinkedFactsheet(link: FactsheetLink): Factsheet | undefined {
    const otherId = link.fromFactsheetId === factsheetId ? link.toFactsheetId : link.fromFactsheetId;
    return fsMap.get(otherId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Linked Factsheets ({links.length})
        </h4>
        <button
          type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={onCreateLink}
        >
          + Link
          {suggestionCount > 0 && (
            <span className="ml-1 text-primary">{suggestionCount} suggestion{suggestionCount !== 1 ? 's' : ''}</span>
          )}
        </button>
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No linked factsheets. Relationship facts can suggest links.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const linked = getLinkedFactsheet(link);
            if (!linked) return null;
            const statusCfg = FACTSHEET_STATUS_CONFIG[linked.status];
            const relLabel = RELATIONSHIP_TYPE_LABELS[link.relationshipType] ?? link.relationshipType;

            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onLinkClick(linked.id)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs hover:bg-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-[9px] font-medium text-muted-foreground bg-muted rounded px-1 py-0.5">
                  {relLabel}
                </span>
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
    </div>
  );
}
