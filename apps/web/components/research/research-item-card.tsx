'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, ExternalLink, Copy, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ResearchItem {
  id: string;
  title: string;
  snippet: string | null;
  url: string | null;
  status: string;
  providerId: string | null;
  notes: string | null;
  createdAt: string;
  personIds: string[];
}

interface ResearchItemCardProps {
  item: ResearchItem;
  onUpdated?: () => void;
  compact?: boolean;
}

export function ResearchItemCard({ item, onUpdated, compact = false }: ResearchItemCardProps) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = useRef(false);

  const commitDelete = useCallback(async () => {
    if (committedRef.current) return;
    committedRef.current = true;
    try {
      const res = await fetch(`/api/research/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onUpdated?.();
    } catch {
      toast.error('Failed to remove bookmark');
      setHidden(false);
      committedRef.current = false;
    }
  }, [item.id, onUpdated]);

  const handleUndo = useCallback(() => {
    if (deleteTimer.current) {
      clearTimeout(deleteTimer.current);
      deleteTimer.current = null;
    }
    committedRef.current = true; // prevent onAutoClose from firing
    setHidden(false);
  }, []);

  const handleQuickRemove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHidden(true);
    committedRef.current = false;
    toast('Bookmark removed', {
      action: { label: 'Undo', onClick: handleUndo },
      duration: 4000,
      onAutoClose: () => commitDelete(),
      onDismiss: () => commitDelete(),
    });
  }, [handleUndo, commitDelete]);

  const handleConfirmedDelete = useCallback(async () => {
    try {
      const res = await fetch(`/api/research/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Bookmark removed');
      onUpdated?.();
    } catch {
      toast.error('Failed to remove bookmark');
    }
  }, [item.id, onUpdated]);

  if (hidden) return null;

  const snippet =
    item.snippet && item.snippet.length > 150
      ? item.snippet.slice(0, 150) + '...'
      : item.snippet;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link href={`/research/item/${item.id}`} className="block">
            <Card size="sm" className={cn('group relative transition-all hover:shadow-sm active:scale-[0.99]', compact ? 'p-2' : 'p-3')}>
              <button
                type="button"
                onClick={handleQuickRemove}
                className="absolute -right-1 -top-1 z-10 flex size-8 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                aria-label="Remove bookmark"
              >
                <X className="size-3 text-muted-foreground" />
              </button>
              <CardHeader>
                <h4 className={cn('pr-5 font-medium leading-snug', compact ? 'text-xs' : 'text-sm')}>{item.title}</h4>
                {compact && item.providerId && (
                  <p className="text-[10px] text-muted-foreground truncate">{item.providerId}</p>
                )}
              </CardHeader>
              {!compact && snippet && (
                <CardContent>
                  <p className="text-xs text-muted-foreground">{snippet}</p>
                </CardContent>
              )}
            </Card>
          </Link>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => router.push(`/research/item/${item.id}`)}>
            <ExternalLink className="size-4" />
            Open
          </ContextMenuItem>

          {item.url && (
            <ContextMenuItem
              onSelect={() => {
                navigator.clipboard.writeText(item.url!);
                toast.success('URL copied');
              }}
            >
              <Copy className="size-4" />
              Copy URL
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          <ContextMenuItem
            onSelect={() => setConfirmOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            Remove Bookmark
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove bookmark?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{item.title}&rdquo; and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
