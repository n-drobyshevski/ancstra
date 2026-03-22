'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HelpCircle,
  Library,
  Search,
  CheckCircle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  usePersonResearchItems,
  usePersonConflicts,
} from '@/lib/research/evidence-client';
import { ProofSection } from './proof-section';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceEntry {
  sourceId: string;
  title: string;
  type: string;
  note: string;
  included: boolean;
}

export interface ProofStatementData {
  question: string;
  sourcesIncluded: SourceEntry[];
  analysis: string;
  conclusion: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  conclusionDate: string;
}

interface ProofTabProps {
  personId: string;
  personName?: string;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function storageKey(personId: string) {
  return `ancstra:proof:${personId}`;
}

function loadProof(personId: string): ProofStatementData | null {
  try {
    const raw = localStorage.getItem(storageKey(personId));
    return raw ? (JSON.parse(raw) as ProofStatementData) : null;
  } catch {
    return null;
  }
}

function saveProof(personId: string, data: ProofStatementData) {
  localStorage.setItem(storageKey(personId), JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

function defaultProof(): ProofStatementData {
  return {
    question: '',
    sourcesIncluded: [],
    analysis: '',
    conclusion: '',
    confidenceLevel: 'medium',
    conclusionDate: new Date().toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProofTab({ personId, personName = 'Unknown' }: ProofTabProps) {
  const { items, isLoading: itemsLoading } = usePersonResearchItems(personId);
  const { conflicts, isLoading: conflictsLoading } = usePersonConflicts(personId);

  const [proof, setProof] = useState<ProofStatementData>(defaultProof);
  const [loaded, setLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadProof(personId);
    if (saved) setProof(saved);
    setLoaded(true);
  }, [personId]);

  // Merge research items into sourcesIncluded when items arrive
  useEffect(() => {
    if (!loaded || items.length === 0) return;

    setProof((prev) => {
      const existingIds = new Set(prev.sourcesIncluded.map((s) => s.sourceId));
      const merged = [...prev.sourcesIncluded];

      for (const item of items) {
        if (!existingIds.has(item.id)) {
          merged.push({
            sourceId: item.id,
            title: item.title,
            type: item.status === 'promoted' ? 'promoted' : 'draft',
            note: '',
            included: item.status === 'promoted',
          });
        }
      }

      // Sort: promoted first, then draft
      merged.sort((a, b) => {
        if (a.type === 'promoted' && b.type !== 'promoted') return -1;
        if (a.type !== 'promoted' && b.type === 'promoted') return 1;
        return 0;
      });

      return { ...prev, sourcesIncluded: merged };
    });
  }, [items, loaded]);

  // Debounced save
  const persistProof = useCallback(
    (data: ProofStatementData) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveProof(personId, data);
      }, 1000);
    },
    [personId],
  );

  const update = useCallback(
    (partial: Partial<ProofStatementData>) => {
      setProof((prev) => {
        const next = { ...prev, ...partial };
        persistProof(next);
        return next;
      });
    },
    [persistProof],
  );

  const updateSource = useCallback(
    (sourceId: string, patch: Partial<SourceEntry>) => {
      setProof((prev) => {
        const next = {
          ...prev,
          sourcesIncluded: prev.sourcesIncluded.map((s) =>
            s.sourceId === sourceId ? { ...s, ...patch } : s,
          ),
        };
        persistProof(next);
        return next;
      });
    },
    [persistProof],
  );

  // Loading skeleton
  if (!loaded || itemsLoading || conflictsLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 print:hidden">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
      <div className="mx-auto max-w-3xl space-y-5 proof-content">
        {/* Header */}
        <div className="flex items-center gap-2 print:hidden">
          <h2 className="text-base font-semibold text-foreground flex-1">
            Proof Summary
          </h2>
        </div>

        {/* Section 1: Research Question */}
        <ProofSection
          title="Research Question"
          description="What question is this proof statement answering?"
          icon={HelpCircle}
        >
          <Textarea
            value={proof.question}
            onChange={(e) => update({ question: e.target.value })}
            placeholder="e.g., Who were the parents of John Smith born c.1845 in County Cork, Ireland?"
            className="min-h-20 resize-y"
          />
        </ProofSection>

        {/* Section 2: Sources Consulted */}
        <ProofSection
          title="Sources Consulted"
          description="Select which sources to include in the proof statement"
          icon={Library}
        >
          {proof.sourcesIncluded.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No research items found for this person. Add sources from the Board tab.
            </p>
          ) : (
            <div className="space-y-2">
              {proof.sourcesIncluded.map((source) => (
                <div
                  key={source.sourceId}
                  className="flex items-start gap-3 rounded-md border border-border p-2.5 bg-background"
                >
                  <input
                    type="checkbox"
                    checked={source.included}
                    onChange={(e) =>
                      updateSource(source.sourceId, {
                        included: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-muted-foreground accent-primary"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {source.title}
                      </span>
                      <Badge
                        variant={
                          source.type === 'promoted' ? 'default' : 'secondary'
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        {source.type}
                      </Badge>
                    </div>
                    <input
                      type="text"
                      value={source.note}
                      onChange={(e) =>
                        updateSource(source.sourceId, { note: e.target.value })
                      }
                      placeholder="Add note about what this source provided..."
                      className="w-full text-xs bg-transparent border-b border-border/50 py-0.5 text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ProofSection>

        {/* Section 3: Information Analysis */}
        <ProofSection
          title="Information Analysis"
          description="Analyze information from each source, addressing conflicts"
          icon={Search}
        >
          <Textarea
            value={proof.analysis}
            onChange={(e) => update({ analysis: e.target.value })}
            placeholder="Analyze the information from each source. Address any conflicts or correlations..."
            className="min-h-32 resize-y"
          />
          {conflicts.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Detected Conflicts
              </p>
              {conflicts.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-md bg-destructive/5 border border-destructive/20 p-2.5 text-sm"
                >
                  <span className="font-medium text-destructive">
                    {c.factType}
                  </span>
                  <span className="text-muted-foreground"> — competing values: </span>
                  {c.facts.map((f, fi) => (
                    <span key={f.id}>
                      {fi > 0 && (
                        <span className="text-muted-foreground"> vs. </span>
                      )}
                      <span className="font-medium">{f.factValue}</span>
                      <span className="text-muted-foreground text-xs ml-1">
                        ({f.confidence})
                      </span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ProofSection>

        {/* Section 4: Conclusion */}
        <ProofSection
          title="Conclusion"
          description="State your conclusion and the evidence that supports it"
          icon={CheckCircle}
        >
          <Textarea
            value={proof.conclusion}
            onChange={(e) => update({ conclusion: e.target.value })}
            placeholder="State your conclusion and the evidence that supports it..."
            className="min-h-24 resize-y"
          />
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Confidence
              </label>
              <Select
                value={proof.confidenceLevel}
                onValueChange={(v) =>
                  update({
                    confidenceLevel: v as 'high' | 'medium' | 'low',
                  })
                }
              >
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Date
              </label>
              <input
                type="date"
                value={proof.conclusionDate}
                onChange={(e) => update({ conclusionDate: e.target.value })}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </ProofSection>
      </div>
  );
}
