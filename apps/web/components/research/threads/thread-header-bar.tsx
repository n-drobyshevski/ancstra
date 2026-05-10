'use client';

import Link from 'next/link';
import { ChevronDown, Notebook } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useActiveThread } from '@/lib/research/active-thread';

export function ThreadHeaderBar() {
  const { thread, loading, setActive } = useActiveThread();
  if (loading || !thread) return null;

  const transition = async (status: 'paused' | 'resolved' | 'abandoned') => {
    const res = await fetch(`/api/research/threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error('Failed to update thread');
      return;
    }
    if (status !== 'paused') {
      await setActive(null);
    }
  };

  return (
    <div className="sticky top-0 z-30 border-b bg-amber-50 px-4 py-1.5 dark:bg-amber-950/30">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Notebook className="size-4 shrink-0" />
          <span className="font-medium shrink-0">Working on:</span>
          <Link href={`/research/threads/${thread.id}`} className="truncate hover:underline">
            {thread.title}
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 gap-1 shrink-0">
              Actions
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setActive(null)}>Clear active thread</DropdownMenuItem>
            <DropdownMenuItem onClick={() => transition('paused')}>Pause</DropdownMenuItem>
            <DropdownMenuItem onClick={() => transition('resolved')}>Resolve</DropdownMenuItem>
            <DropdownMenuItem onClick={() => transition('abandoned')} className="text-destructive">
              Abandon
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
