'use client';

import { useState, useCallback } from 'react';
import { Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HintCard } from './hint-card';
import type { MatchCandidateRow } from './hint-card';
import { usePersonHints, generateHints, updateHintStatus } from '@/lib/research/hints-client';
import type { PersonSummary } from './hint-comparison';

type FilterTab = 'pending' | 'accepted' | 'rejected' | 'all';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

interface HintsPanelProps {
  personId: string;
  localPerson: PersonSummary;
}

export function HintsPanel({ personId, localPerson }: HintsPanelProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [generating, setGenerating] = useState(false);

  const statusParam = activeTab === 'all' ? undefined : activeTab;
  const { hints, isLoading, error, refetch } = usePersonHints(personId, statusParam);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      await generateHints(personId);
      await refetch();
    } finally {
      setGenerating(false);
    }
  }, [personId, refetch]);

  const handleAccept = useCallback(async (id: string) => {
    await updateHintStatus(id, 'accepted');
    await refetch();
  }, [refetch]);

  const handleReject = useCallback(async (id: string) => {
    await updateHintStatus(id, 'rejected');
    await refetch();
  }, [refetch]);

  const handleMaybe = useCallback(async (id: string) => {
    await updateHintStatus(id, 'maybe');
    await refetch();
  }, [refetch]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold">
            Hints
            {hints.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {hints.length}
              </Badge>
            )}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5 mr-1" />
          )}
          {generating ? 'Searching...' : 'Generate Hints'}
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load hints: {error.message}
        </div>
      ) : hints.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <Lightbulb className="mx-auto size-6 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {activeTab === 'pending'
              ? "No hints yet. Click 'Generate Hints' to search for matching records."
              : `No ${activeTab} hints.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map((hint: MatchCandidateRow) => (
            <HintCard
              key={hint.id}
              hint={hint}
              localPerson={localPerson}
              onAccept={handleAccept}
              onReject={handleReject}
              onMaybe={handleMaybe}
            />
          ))}
        </div>
      )}
    </div>
  );
}
