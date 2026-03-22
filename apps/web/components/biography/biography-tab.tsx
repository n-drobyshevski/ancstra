'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, Loader2 } from 'lucide-react';
import {
  BiographyOptions,
  type BiographyOptionsResult,
} from '@/components/biography/biography-options';
import { BiographyViewer } from '@/components/biography/biography-viewer';

interface BiographyTabProps {
  personId: string;
}

export function BiographyTab({ personId }: BiographyTabProps) {
  const [biographyText, setBiographyText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Check cache on mount
  const checkCache = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ai/biography?personId=${encodeURIComponent(personId)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setBiographyText(data.text);
        }
      }
    } catch {
      // No cached biography — that is fine
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    checkCache();
  }, [checkCache]);

  async function handleGenerate(options: BiographyOptionsResult) {
    setOptionsOpen(false);
    setStreaming(true);
    setBiographyText('');

    try {
      const res = await fetch('/api/ai/biography', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId,
          tone: options.tone,
          length: options.length,
          focus: options.focus,
        }),
      });

      if (!res.ok || !res.body) {
        setBiographyText(null);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setBiographyText(accumulated);
      }

      // Final decode flush
      accumulated += decoder.decode();
      setBiographyText(accumulated);
    } catch {
      // Stream failed
    } finally {
      setStreaming(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking for biography...
      </div>
    );
  }

  if (streaming) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating biography...
        </div>
        {biographyText && (
          <div className="rounded-lg border bg-card p-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {biographyText.split('\n\n').map((paragraph, i) => (
                <p
                  key={i}
                  className="font-serif text-sm leading-relaxed text-foreground"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!biographyText) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="mb-4 text-sm text-muted-foreground">
            No biography has been generated yet.
          </p>
          <Button onClick={() => setOptionsOpen(true)}>
            Generate Biography
          </Button>
        </div>
        <BiographyOptions
          open={optionsOpen}
          onOpenChange={setOptionsOpen}
          onGenerate={handleGenerate}
        />
      </>
    );
  }

  return (
    <>
      <BiographyViewer
        text={biographyText}
        onRegenerate={() => setOptionsOpen(true)}
        onTextChange={setBiographyText}
      />
      <BiographyOptions
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        onGenerate={handleGenerate}
      />
    </>
  );
}
