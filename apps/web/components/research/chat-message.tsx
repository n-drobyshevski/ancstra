'use client';

import type { UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCallIndicator } from './tool-call-indicator';

interface ChatMessageProps {
  message: UIMessage;
}

function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const textContent = getTextContent(message);

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Content */}
      <div
        className={cn(
          'max-w-[80%] space-y-1',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Text content */}
        {textContent && (
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm',
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-card ring-1 ring-foreground/10 rounded-tl-sm'
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{textContent}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{textContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Tool invocations */}
        {message.parts.map((part, i) => {
          if (part.type.startsWith('tool-')) {
            const toolPart = part as { toolCallId: string; toolName: string; state: string; input?: unknown; output?: unknown };
            const status = toolPart.state === 'result' ? 'complete' : 'calling';

            return (
              <ToolCallIndicator
                key={`tool-${i}`}
                toolName={toolPart.toolName}
                status={status}
                args={toolPart.input as Record<string, unknown> | undefined}
                result={toolPart.state === 'result' ? toolPart.output : undefined}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
