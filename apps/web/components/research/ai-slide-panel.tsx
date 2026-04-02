'use client';

import { Suspense, useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { ChatPanel } from './chat-panel';
import { cn } from '@/lib/utils';

interface AiSlidePanelProps {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string | null;
  onPromptConsumed?: () => void;
  searchContext?: { query: string; topResults: { title: string; providerId: string }[] } | null;
}

export function AiSlidePanel({
  open,
  onClose,
  initialPrompt,
  onPromptConsumed,
  searchContext,
}: AiSlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      ref={panelRef}
      role="complementary"
      aria-label="AI Chat"
      className={cn(
        'fixed inset-y-0 right-0 z-40 w-[330px] border-l border-border bg-background shadow-lg',
        'flex flex-col',
        'motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-out',
        'motion-reduce:transition-none',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          AI Chat
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close AI Chat"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Chat content */}
      <div className="flex-1 overflow-hidden">
        {open && (
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading chat...</div>}>
            <ChatPanel
              initialPrompt={initialPrompt}
              onPromptConsumed={onPromptConsumed}
              searchContext={searchContext}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
