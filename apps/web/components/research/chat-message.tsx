'use client';

import type { Message } from 'ai';
import ReactMarkdown from 'react-markdown';
import { User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCallIndicator } from './tool-call-indicator';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

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
        {message.content && (
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm',
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-card ring-1 ring-foreground/10 rounded-tl-sm'
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Tool invocations */}
        {message.parts?.map((part, i) => {
          if (part.type === 'tool-invocation') {
            const toolInvocation = part.toolInvocation;
            const status =
              toolInvocation.state === 'result'
                ? 'complete'
                : toolInvocation.state === 'call'
                  ? 'calling'
                  : 'calling';

            return (
              <ToolCallIndicator
                key={`tool-${i}`}
                toolName={toolInvocation.toolName}
                status={status}
                args={toolInvocation.args}
                result={
                  toolInvocation.state === 'result'
                    ? toolInvocation.result
                    : undefined
                }
              />
            );
          }
          return null;
        })}

        {/* Timestamp on hover */}
        {message.createdAt && (
          <p className="px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
