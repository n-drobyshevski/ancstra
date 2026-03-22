'use client';

import { useState } from 'react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { extractFacts } from '@/lib/research/evidence-client';

interface Fact {
  id: string;
  factType: string;
  factValue: string;
  confidence: string;
}

interface DetailPanelFactsProps {
  facts: Fact[];
  itemId: string;
  personId: string;
  snippetText: string | null;
  onFactsChanged: () => void;
}

const FACT_TYPES = [
  'Birth Date',
  'Birth Place',
  'Death Date',
  'Death Place',
  'Marriage Date',
  'Marriage Place',
  'Occupation',
  'Residence',
  'Immigration',
  'Military Service',
  'Education',
  'Religion',
  'Other',
];

const CONFIDENCE_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  high: { label: 'High', variant: 'default' },
  medium: { label: 'Medium', variant: 'secondary' },
  low: { label: 'Low', variant: 'destructive' },
};

export function DetailPanelFacts({
  facts,
  itemId,
  personId,
  snippetText,
  onFactsChanged,
}: DetailPanelFactsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFactType, setNewFactType] = useState('');
  const [newFactValue, setNewFactValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  async function handleAddFact() {
    if (!newFactType || !newFactValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/research/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId,
          researchItemId: itemId,
          factType: newFactType,
          factValue: newFactValue.trim(),
          confidence: 'medium',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add fact');
      }
      toast.success('Fact added');
      setNewFactType('');
      setNewFactValue('');
      setShowAddForm(false);
      onFactsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add fact');
    } finally {
      setSaving(false);
    }
  }

  async function handleExtract() {
    if (!snippetText) {
      toast.error('No text to extract from');
      return;
    }
    setExtracting(true);
    try {
      await extractFacts(snippetText, personId);
      toast.success('Facts extracted');
      onFactsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Facts ({facts.length})
        </h4>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="size-3" />
          Add
        </Button>
      </div>

      {/* Existing facts */}
      {facts.length > 0 ? (
        <div className="space-y-1.5">
          {facts.map((fact) => {
            const conf = CONFIDENCE_BADGE[fact.confidence] ?? CONFIDENCE_BADGE.medium;
            return (
              <div
                key={fact.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {fact.factType}
                  </p>
                  <p className="text-sm truncate">{fact.factValue}</p>
                </div>
                <Badge variant={conf.variant} className="shrink-0 text-[10px]">
                  {conf.label}
                </Badge>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No facts extracted yet.</p>
      )}

      {/* Add fact inline form */}
      {showAddForm && (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <Select value={newFactType} onValueChange={setNewFactType}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Fact type..." />
            </SelectTrigger>
            <SelectContent>
              {FACT_TYPES.map((ft) => (
                <SelectItem key={ft} value={ft}>
                  {ft}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Value..."
            value={newFactValue}
            onChange={(e) => setNewFactValue(e.target.value)}
            className="h-7 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFact();
            }}
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddFact}
              disabled={saving || !newFactType || !newFactValue.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* AI extraction button */}
      {snippetText && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleExtract}
          disabled={extracting}
        >
          {extracting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {extracting ? 'Extracting...' : 'Extract Facts with AI'}
        </Button>
      )}
    </div>
  );
}
