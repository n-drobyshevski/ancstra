'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles, Info, EllipsisVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface ItemDetailBottomBarProps {
  url: string | null;
  askAiPrompt: string;
  onOpenDetails: () => void;
  onDelete: () => Promise<void>;
  factCount: number;
}

export function ItemDetailBottomBar({
  url,
  askAiPrompt,
  onOpenDetails,
  onDelete,
  factCount,
}: ItemDetailBottomBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div
        role="toolbar"
        aria-label="Item actions"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background px-2 pb-[env(safe-area-inset-bottom)] pt-2"
      >
        {/* Open URL */}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-5" />
            <span className="text-[10px] font-medium">Open URL</span>
          </a>
        )}

        {/* Ask AI */}
        <Link
          href={`/research?askAi=${encodeURIComponent(askAiPrompt)}`}
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Sparkles className="size-5" />
          <span className="text-[10px] font-medium">Ask AI</span>
        </Link>

        {/* Details */}
        <button
          type="button"
          onClick={onOpenDetails}
          className="relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="size-5" />
          {factCount > 0 && (
            <span className="absolute -right-0.5 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {factCount > 99 ? '99+' : factCount}
            </span>
          )}
          <span className="text-[10px] font-medium">Details</span>
        </button>

        {/* More */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <EllipsisVertical className="size-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete research item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this item and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
