'use client';

import { ExternalLink, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetailPanelActionsProps {
  itemId: string;
  status: string;
  url: string | null;
  onStatusChanged: () => void;
}

export function DetailPanelActions({
  url,
}: DetailPanelActionsProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Actions
      </h4>

      <div className="flex flex-col gap-1.5">
        {url && (
          <>
            <Button size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                View Source
              </a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Archive className="size-3.5" />
                View Archive
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
