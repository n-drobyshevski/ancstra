'use client';

import { Suspense, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { ChatPanel } from './chat-panel';

interface MobileAiSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string | null;
  onPromptConsumed?: () => void;
  searchContext?: { query: string; topResults: { title: string; providerId: string }[] } | null;
}

export function MobileAiSheet({
  open,
  onOpenChange,
  initialPrompt,
  onPromptConsumed,
  searchContext,
}: MobileAiSheetProps) {
  const snapPoints = ['50%' as const, 1];
  const [snap, setSnap] = useState<number | string | null>(snapPoints[0]);

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      fadeFromIndex={0}
      modal
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DrawerPrimitive.Content
          role="dialog"
          aria-modal="true"
          aria-label="AI Chat"
          className="fixed inset-x-0 bottom-0 z-50 flex h-full max-h-[97%] flex-col rounded-t-xl border-t border-border bg-background"
        >
          {/* Drag handle */}
          <div className="mx-auto mt-3 h-1 w-12 shrink-0 rounded-full bg-muted" />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" />
              <DrawerPrimitive.Title>AI Chat</DrawerPrimitive.Title>
            </div>
            <DrawerPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          </div>

          {/* Chat content — overflow only when fully expanded */}
          <div className={snap === 1 ? 'flex-1 overflow-y-auto' : 'flex-1 overflow-hidden'}>
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
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
