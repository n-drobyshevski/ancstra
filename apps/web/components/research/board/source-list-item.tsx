'use client';

import { cn } from '@/lib/utils';
import { ProviderBadge } from '../provider-badge';

interface SourceListItemProps {
  id: string;
  title: string;
  snippet: string | null;
  status: string;
  providerId: string | null;
  factCount: number;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  promoted: { color: 'bg-green-500', label: 'SOURCE' },
  draft: { color: 'bg-yellow-500', label: 'DRAFT' },
  dismissed: { color: 'bg-muted-foreground/50', label: 'DISMISSED' },
};

export function SourceListItem({
  title,
  snippet,
  status,
  providerId,
  factCount,
  isSelected,
  onClick,
}: SourceListItemProps) {
  const dot = STATUS_DOT[status] ?? STATUS_DOT.draft;

  const preview =
    snippet && snippet.length > 80 ? snippet.slice(0, 80) + '...' : snippet;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent',
      )}
    >
      {/* Status row */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('size-2 rounded-full shrink-0', dot.color)} />
        <span
          className={cn(
            'text-[10px] font-semibold tracking-wide uppercase',
            status === 'promoted' && 'text-green-600 dark:text-green-400',
            status === 'draft' && 'text-yellow-600 dark:text-yellow-400',
            status === 'dismissed' && 'text-muted-foreground',
          )}
        >
          {dot.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium leading-snug line-clamp-2">{title}</p>

      {/* Snippet preview */}
      {preview && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {preview}
        </p>
      )}

      {/* Footer: provider + fact count */}
      <div className="mt-2 flex items-center gap-2">
        {providerId && <ProviderBadge providerId={providerId} />}
        {factCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {factCount} fact{factCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  );
}
