'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Sparkles, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResearchHub } from './research-hub';
import { ChatPanel } from './chat-panel';
import { InboxTab } from './inbox/inbox-tab';
import { useInboxCount } from '@/lib/research/factsheet-client';
import { Badge } from '@/components/ui/badge';

type ResearchView = 'search' | 'chat' | 'inbox';

interface SearchContext {
  query: string;
  topResults: { title: string; providerId: string }[];
}

const tabs: { value: ResearchView; label: string; icon: typeof Search; shortcut: string }[] = [
  { value: 'search', label: 'Search', icon: Search, shortcut: '1' },
  { value: 'chat', label: 'AI Chat', icon: Sparkles, shortcut: '2' },
  { value: 'inbox', label: 'Inbox', icon: Inbox, shortcut: '3' },
];

function ResearchLayoutInner() {
  const [activeView, setActiveView] = useState<ResearchView>('search');
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  const { count: inboxCount } = useInboxCount();

  const searchParams = useSearchParams();
  const router = useRouter();

  const handleAskAi = useCallback((prompt: string) => {
    setPendingAiPrompt(prompt);
    setActiveView('chat');
  }, []);

  const handlePromptConsumed = useCallback(() => {
    setPendingAiPrompt(null);
  }, []);

  // Keyboard shortcuts: Ctrl/Cmd + 1/2/3 to switch tabs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const tab = tabs.find(t => t.shortcut === e.key);
      if (tab) {
        e.preventDefault();
        setActiveView(tab.value);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Read ?askAi= param on mount (from item detail "Ask AI" button)
  useEffect(() => {
    const askAi = searchParams.get('askAi');
    if (askAi) {
      setPendingAiPrompt(askAi);
      setActiveView('chat');
      // Clean the URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('askAi');
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '/research');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — only on mount

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveView(tab.value)}
              className={cn(
                'relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
                'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeView === tab.value
                  ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              <span className="hidden text-[10px] text-muted-foreground/50 sm:inline">
                ⌘{tab.shortcut}
              </span>
              {tab.value === 'inbox' && inboxCount > 0 && (
                <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-primary/20 text-primary">
                  {inboxCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'search' && (
          <div className="h-full overflow-y-auto p-6">
            <ResearchHub
              onAskAi={handleAskAi}
              onSearchContextChange={setSearchContext}
            />
          </div>
        )}
        {activeView === 'chat' && (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading chat...
              </div>
            }
          >
            <ChatPanel
              initialPrompt={pendingAiPrompt}
              onPromptConsumed={handlePromptConsumed}
              searchContext={searchContext}
            />
          </Suspense>
        )}
        {activeView === 'inbox' && (
          <div className="h-full overflow-y-auto p-6">
            <InboxTab />
          </div>
        )}
      </div>
    </div>
  );
}

export function ResearchLayout() {
  return (
    <Suspense>
      <ResearchLayoutInner />
    </Suspense>
  );
}
