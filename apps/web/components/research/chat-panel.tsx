'use client';

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useChat } from 'ai/react';
import {
  Send,
  RotateCcw,
  Loader2,
  Sparkles,
  Search,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatMessage } from './chat-message';
import { CostBadge } from './cost-badge';

const STARTER_PROMPTS = [
  { label: 'What gaps exist in my tree?', icon: AlertTriangle },
  { label: 'Suggest records to search for', icon: Search },
  { label: 'What should I research next?', icon: Lightbulb },
];

interface ChatPanelProps {
  focusPersonId?: string;
  initialPrompt?: string | null;
  onPromptConsumed?: () => void;
  searchContext?: { query: string; topResults: { title: string; providerId: string }[] } | null;
}

export function ChatPanel({ focusPersonId, initialPrompt, onPromptConsumed, searchContext }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    setMessages,
    append,
  } = useChat({
    api: '/api/ai/chat',
    body: {
      focusPersonId,
      ...(searchContext && {
        searchContext: `User was searching for: "${searchContext.query}". Top results: ${searchContext.topResults.map((r) => `${r.title} (${r.providerId})`).join(', ')}`,
      }),
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-send initial prompt from "Ask AI" button
  useEffect(() => {
    if (initialPrompt) {
      append({ role: 'user', content: initialPrompt });
      onPromptConsumed?.();
    }
  }, [initialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle enter to submit (shift+enter for newline)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && input.trim()) {
          handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
      }
    },
    [isLoading, input, handleSubmit]
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const handleStarterClick = useCallback(
    (prompt: string) => {
      append({ role: 'user', content: prompt });
    },
    [append]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">AI Research Assistant</h2>
        </div>
        <div className="flex items-center gap-2">
          <CostBadge />
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="h-7 text-xs"
            >
              <RotateCcw className="mr-1 size-3" />
              New Chat
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="space-y-2">
              <Sparkles className="mx-auto size-8 text-muted-foreground" />
              <h3 className="text-base font-medium">Research Assistant</h3>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Ask me anything about your family tree. I can search records,
                analyze gaps, and help with research.
              </p>
            </div>

            {/* Starter prompts */}
            <div className="flex flex-wrap justify-center gap-2">
              {STARTER_PROMPTS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleStarterClick(label)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="group">
              <ChatMessage message={message} />
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              {error.message.includes('budget')
                ? 'Monthly AI budget reached. Increase your limit in settings.'
                : 'Something went wrong.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reload()}
              className="mt-2 h-7 text-xs"
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your family tree..."
            className="min-h-10 max-h-32 resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !input.trim()}
            className="h-10 w-10 shrink-0 p-0"
          >
            <Send className="size-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
