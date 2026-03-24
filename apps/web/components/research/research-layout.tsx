'use client';

import { useState, useCallback, Suspense } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResearchHub } from './research-hub';
import { ChatPanel } from './chat-panel';

type ResearchView = 'search' | 'chat';

interface SearchContext {
  query: string;
  topResults: { title: string; providerId: string }[];
}

const tabs: { value: ResearchView; label: string; icon: typeof Search }[] = [
  { value: 'search', label: 'Search', icon: Search },
  { value: 'chat', label: 'AI Chat', icon: Sparkles },
];

export function ResearchLayout() {
  const [activeView, setActiveView] = useState<ResearchView>('search');
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);

  const handleAskAi = useCallback((prompt: string) => {
    setPendingAiPrompt(prompt);
    setActiveView('chat');
  }, []);

  const handlePromptConsumed = useCallback(() => {
    setPendingAiPrompt(null);
  }, []);

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
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'search' ? (
          <div className="h-full overflow-y-auto p-6">
            <ResearchHub
              onAskAi={handleAskAi}
              onSearchContextChange={setSearchContext}
            />
          </div>
        ) : (
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
      </div>
    </div>
  );
}
