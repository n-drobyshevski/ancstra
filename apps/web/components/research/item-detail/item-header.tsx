'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHeaderContent } from '@/lib/header-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ProviderBadge } from '../provider-badge';
import { STATUS_CONFIG, DISCOVERY_METHOD_LABELS } from '@/lib/research/constants';
import { toast } from 'sonner';

interface ItemHeaderProps {
  item: {
    id: string;
    title: string;
    url: string | null;
    status: string;
    providerId: string | null;
    discoveryMethod: string;
    createdAt: string;
  };
  onStatusChange: (newStatus: string) => void;
  onDeleted: () => void;
}

export function ItemHeader({ item, onStatusChange, onDeleted }: ItemHeaderProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/research/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      onStatusChange(newStatus);
      toast.success(
        newStatus === 'promoted' ? 'Item promoted' :
        newStatus === 'dismissed' ? 'Item dismissed' : 'Item restored'
      );
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/research/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Item deleted');
      onDeleted();
      router.push('/research');
    } catch {
      toast.error('Failed to delete item');
      setDeleting(false);
    }
  }

  const { setHeaderContent } = useHeaderContent();
  const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const methodLabel = DISCOVERY_METHOD_LABELS[item.discoveryMethod] ?? item.discoveryMethod;

  // Push breadcrumb into the app header bar
  useEffect(() => {
    setHeaderContent(
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm">
          <li>
            <Link href="/research" className="text-muted-foreground transition-colors hover:text-primary">
              Research
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3 text-muted-foreground" />
          </li>
          <li aria-current="page">
            <span className="truncate font-medium text-foreground">{item.title}</span>
          </li>
        </ol>
      </nav>
    );
    return () => setHeaderContent(null);
  }, [item.title, setHeaderContent]);

  const askAiPrompt = `Tell me more about this record: "${item.title}"${
    item.providerId ? ` from ${item.providerId}` : ''
  }${item.url ? `. URL: ${item.url}` : ''}`;

  return (
    <div className="space-y-3">
      {/* Title + Badges */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold">{item.title}</h1>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {item.providerId && <ProviderBadge providerId={item.providerId} />}
          <Badge variant="outline" className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {methodLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {item.status === 'draft' && (
          <>
            <span title="Mark as a verified source for your research">
              <Button
                size="sm"
                onClick={() => updateStatus('promoted')}
                disabled={updating}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Promote
              </Button>
            </span>
            <span title="Hide this item — you can restore it later">
              <Button size="sm" variant="outline" onClick={() => updateStatus('dismissed')} disabled={updating}>
                Dismiss
              </Button>
            </span>
          </>
        )}
        {item.status === 'dismissed' && (
          <Button size="sm" variant="outline" onClick={() => updateStatus('draft')} disabled={updating}>
            Restore
          </Button>
        )}
        {item.url && (
          <Button size="sm" variant="outline" asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open URL
            </a>
          </Button>
        )}
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/research?askAi=${encodeURIComponent(askAiPrompt)}`}>
            <Sparkles className="size-3.5" />
            Ask AI
          </Link>
        </Button>

        <div className="flex-1" />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={deleting}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete research item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &ldquo;{item.title}&rdquo; and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
