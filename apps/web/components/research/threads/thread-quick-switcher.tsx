'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Check, Loader2, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useThreadList } from '@/lib/research/use-thread-list';
import { useActiveThread } from '@/lib/research/active-thread';

interface ThreadQuickSwitcherProps {
  /** Optional className on the trigger so the parent can tune sizing. */
  className?: string;
}

// Compact popover that lets the user switch the active thread from
// anywhere inside /research/*. Shows ONLY active threads — paused /
// resolved / abandoned belong on the full list page; the footer link
// "See all threads →" links there. Keeps the cognitive load of the
// switcher low (UI/UX Pro Max §8 progressive-disclosure).
export function ThreadQuickSwitcher({ className }: ThreadQuickSwitcherProps) {
  const { threads, loading } = useThreadList({ status: 'active' });
  const { thread: activeThread, setActive } = useActiveThread();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const handleSelect = async (id: string) => {
    if (id === activeThread?.id) {
      setOpen(false);
      return;
    }
    setSwitching(id);
    try {
      await setActive(id);
      setOpen(false);
    } catch {
      toast.error('Failed to switch active thread');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className={cn('h-7 gap-1', className)}
          aria-label="Switch active thread"
        >
          <ChevronDown className="size-3" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="px-3 py-2 border-b">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active threads {threads && threads.length > 0 ? `(${threads.length})` : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Loading…
          </div>
        ) : !threads || threads.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            No active threads. Start one from a person on the canvas.
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1">
            {threads.map(t => {
              const isCurrent = t.id === activeThread?.id;
              const isLoading = switching === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(t.id)}
                    disabled={isLoading}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                      'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                      isCurrent && 'bg-muted/50',
                    )}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {isLoading ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : isCurrent ? (
                        <Check className="size-3.5 text-primary" aria-hidden />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t">
          <Link
            href="/research/threads"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary hover:bg-muted"
          >
            <ListChecks className="size-3.5" aria-hidden />
            See all threads →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
