'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ResearchHub } from './research-hub';
import { AiSlidePanel } from './ai-slide-panel';
import { MobileBottomBar } from './mobile-bottom-bar';
import { MobileAiSheet } from './mobile-ai-sheet';
import { TextPasteModal } from './text-paste-modal';
import { useResearchItems } from '@/lib/research/search-client';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

interface SearchContext {
  query: string;
  topResults: { title: string; providerId: string }[];
}

function ResearchLayoutInner() {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  const [mobileTextModalOpen, setMobileTextModalOpen] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { data: itemsData } = useResearchItems();
  const bookmarkCount = itemsData?.items?.length ?? 0;

  const handleAskAi = useCallback((prompt: string) => {
    setPendingAiPrompt(prompt);
    if (isDesktop) {
      setAiPanelOpen(true);
    } else {
      setMobileAiOpen(true);
    }
  }, [isDesktop]);

  const handlePromptConsumed = useCallback(() => {
    setPendingAiPrompt(null);
  }, []);

  const handleOpenAiPanel = useCallback(() => {
    if (isDesktop) {
      setAiPanelOpen(true);
    } else {
      setMobileAiOpen(true);
    }
  }, [isDesktop]);

  const handleCloseAiPanel = useCallback(() => {
    setAiPanelOpen(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+Shift+A — toggle AI panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        if (isDesktop) {
          setAiPanelOpen((prev) => !prev);
        } else {
          setMobileAiOpen((prev) => !prev);
        }
        return;
      }

      // Ctrl+K — focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="Search records or paste a URL"]')?.focus();
        return;
      }

      // / — focus search (only when not in input)
      if (e.key === '/' && !inInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="Search records or paste a URL"]')?.focus();
        return;
      }

      // Escape — close AI panel
      if (e.key === 'Escape' && aiPanelOpen) {
        setAiPanelOpen(false);
        return;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiPanelOpen, isDesktop]);

  // Read ?askAi= param on mount (from item detail "Ask AI" button)
  useEffect(() => {
    const askAi = searchParams.get('askAi');
    if (askAi) {
      setPendingAiPrompt(askAi);
      if (isDesktop) {
        setAiPanelOpen(true);
      } else {
        setMobileAiOpen(true);
      }
      const params = new URLSearchParams(searchParams.toString());
      params.delete('askAi');
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '/research');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col">
      {/* Skip to main content */}
      <a
        href="#research-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Desktop top bar with AI toggle */}
      <div className="hidden items-center gap-3 border-b border-border px-4 py-3 lg:flex">
        <h1 className="text-lg font-bold whitespace-nowrap">Research</h1>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleOpenAiPanel}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                aiPanelOpen
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground border border-border hover:bg-accent/80'
              )}
            >
              <Sparkles className="size-4" />
              AI Chat
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Toggle AI Chat <kbd className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">Ctrl+Shift+A</kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main content area */}
      <div
        id="research-main"
        role="main"
        className={cn(
          'flex-1 overflow-y-auto p-4 pb-[calc(60px+env(safe-area-inset-bottom))] lg:pb-4',
          aiPanelOpen && isDesktop && 'lg:pr-[346px]'
        )}
      >
        <ResearchHub
          onAskAi={handleAskAi}
          onOpenAiPanel={handleOpenAiPanel}
          onSearchContextChange={setSearchContext}
          aiPanelOpen={aiPanelOpen}
        />
      </div>

      {/* Desktop AI slide-over panel */}
      <AiSlidePanel
        open={aiPanelOpen && !!isDesktop}
        onClose={handleCloseAiPanel}
        initialPrompt={pendingAiPrompt}
        onPromptConsumed={handlePromptConsumed}
        searchContext={searchContext}
      />

      {/* Mobile bottom bar */}
      <div className="lg:hidden">
        <MobileBottomBar
          onPasteText={() => setMobileTextModalOpen(true)}
          onScrapeUrl={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
              document.querySelector<HTMLInputElement>('[aria-label="Search records or paste a URL"]')?.focus();
            }, 300);
          }}
          onOpenAi={() => setMobileAiOpen(true)}
          bookmarkCount={bookmarkCount}
        />
      </div>

      {/* Mobile AI half-sheet */}
      <MobileAiSheet
        open={mobileAiOpen}
        onOpenChange={setMobileAiOpen}
        initialPrompt={pendingAiPrompt}
        onPromptConsumed={handlePromptConsumed}
        searchContext={searchContext}
      />

      {/* Mobile text paste modal (triggered from bottom bar) */}
      <TextPasteModal
        open={mobileTextModalOpen}
        onOpenChange={setMobileTextModalOpen}
      />
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
