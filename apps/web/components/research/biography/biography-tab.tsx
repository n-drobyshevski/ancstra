'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { BiographyOptions, type BiographyOptionsResult } from '@/components/biography/biography-options';
import { BiographyViewer } from '@/components/biography/biography-viewer';
import { HistoricalEvent } from '@/components/timeline/historical-event';

interface ResearchBiographyTabProps {
  personId: string;
  personName: string;
}

interface HistoricalEventData {
  year: number;
  title: string;
  description: string;
  relevance: string;
}

export function ResearchBiographyTab({ personId, personName }: ResearchBiographyTabProps) {
  // --- Biography state ---
  const [biographyText, setBiographyText] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // --- Historical context state ---
  const [showHistorical, setShowHistorical] = useState(false);
  const [historicalEvents, setHistoricalEvents] = useState<HistoricalEventData[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalLoaded, setHistoricalLoaded] = useState(false);

  // Check for cached biography on mount
  const checkBioCache = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/biography?personId=${personId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.text) setBiographyText(data.text);
      }
    } catch {
      // ignore
    } finally {
      setBioLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    checkBioCache();
  }, [checkBioCache]);

  // Generate biography with streaming
  const handleGenerate = useCallback(
    async (options: BiographyOptionsResult) => {
      setStreaming(true);
      setOptionsOpen(false);
      setBiographyText('');
      try {
        const res = await fetch('/api/ai/biography', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId, ...options }),
        });
        if (!res.ok || !res.body) throw new Error('Generation failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setBiographyText(text);
        }
      } catch {
        toast.error('Failed to generate biography');
      } finally {
        setStreaming(false);
      }
    },
    [personId],
  );

  // Fetch historical context on toggle
  const handleHistoricalToggle = useCallback(
    async (checked: boolean) => {
      setShowHistorical(checked);
      if (!checked || historicalLoaded) return;
      setHistoricalLoading(true);
      try {
        const cacheRes = await fetch(`/api/ai/historical-context?personId=${personId}`);
        if (cacheRes.ok) {
          const data = await cacheRes.json();
          if (data.events?.length) {
            setHistoricalEvents(data.events);
            setHistoricalLoaded(true);
            return;
          }
        }
      } catch {
        // ignore, will show generate button
      } finally {
        setHistoricalLoading(false);
      }
    },
    [personId, historicalLoaded],
  );

  const handleGenerateHistorical = useCallback(async () => {
    setHistoricalLoading(true);
    try {
      const res = await fetch('/api/ai/historical-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setHistoricalEvents(data.events ?? []);
      setHistoricalLoaded(true);
    } catch {
      toast.error('Failed to generate historical context');
    } finally {
      setHistoricalLoading(false);
    }
  }, [personId]);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Biography */}
      <Card>
        <CardHeader>
          <CardTitle>Biography</CardTitle>
        </CardHeader>
        <CardContent>
          {bioLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : biographyText ? (
            <BiographyViewer
              text={biographyText}
              onRegenerate={() => setOptionsOpen(true)}
              onTextChange={setBiographyText}
            />
          ) : (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <p className="mb-3 text-sm">No biography generated yet.</p>
              <Button onClick={() => setOptionsOpen(true)}>Generate Biography</Button>
              <p className="mt-2 text-xs">~$0.02 per generation</p>
            </div>
          )}
          <BiographyOptions
            open={optionsOpen}
            onOpenChange={setOptionsOpen}
            onGenerate={handleGenerate}
            generating={streaming}
          />
        </CardContent>
      </Card>

      {/* Historical Context */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historical Context</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="historical-toggle"
              checked={showHistorical}
              onCheckedChange={handleHistoricalToggle}
            />
            <Label htmlFor="historical-toggle" className="text-sm">
              Show
            </Label>
          </div>
        </CardHeader>
        {showHistorical && (
          <CardContent>
            {historicalLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : historicalEvents.length > 0 ? (
              <div className="space-y-4">
                {historicalEvents.map((event, i) => (
                  <HistoricalEvent key={i} {...event} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <Globe className="mb-2 size-8" />
                <p className="mb-3 text-sm">
                  See world events during {personName}&apos;s lifetime.
                </p>
                <Button variant="outline" onClick={handleGenerateHistorical}>
                  Generate Historical Context
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
