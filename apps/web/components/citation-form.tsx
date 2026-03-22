'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { Source, CreateSourceInput } from '@ancstra/shared';

const CONFIDENCE_OPTIONS = ['high', 'medium', 'low', 'disputed'] as const;

const SOURCE_TYPES = [
  'vital_record', 'census', 'military', 'church', 'newspaper',
  'immigration', 'land', 'probate', 'cemetery', 'photograph',
  'personal_knowledge', 'correspondence', 'book', 'online', 'other',
] as const;

interface CitationFormProps {
  personId?: string;
  eventId?: string;
  familyId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function CitationForm({ personId, eventId, familyId, onSave, onCancel }: CitationFormProps) {
  // Source search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Source[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [showNewSourceForm, setShowNewSourceForm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Citation fields
  const [citationDetail, setCitationDetail] = useState('');
  const [citationText, setCitationText] = useState('');
  const [confidence, setConfidence] = useState<(typeof CONFIDENCE_OPTIONS)[number]>('medium');

  // New source inline form
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceAuthor, setNewSourceAuthor] = useState('');
  const [newSourceType, setNewSourceType] = useState<string>('other');

  const [loading, setLoading] = useState(false);

  // Debounced source search
  const searchSources = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/api/sources?q=${encodeURIComponent(q)}&pageSize=5`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.sources ?? data);
        setShowDropdown(true);
      }
    } catch {
      // silently ignore search errors
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm && !selectedSource) {
        searchSources(searchTerm);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedSource, searchSources]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelectSource(source: Source) {
    setSelectedSource(source);
    setSearchTerm(source.title);
    setShowDropdown(false);
    setShowNewSourceForm(false);
  }

  function handleClearSource() {
    setSelectedSource(null);
    setSearchTerm('');
    setShowNewSourceForm(false);
  }

  async function createSourceInline(): Promise<string | null> {
    if (!newSourceTitle.trim()) {
      toast.error('Source title is required');
      return null;
    }
    const body: CreateSourceInput = {
      title: newSourceTitle.trim(),
      author: newSourceAuthor.trim() || undefined,
      sourceType: newSourceType as CreateSourceInput['sourceType'],
    };
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? 'Failed to create source');
      return null;
    }
    const source: Source = await res.json();
    return source.id;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      let sourceId = selectedSource?.id;

      // If creating a new source inline, do that first
      if (showNewSourceForm && !sourceId) {
        const newId = await createSourceInline();
        if (!newId) {
          setLoading(false);
          return;
        }
        sourceId = newId;
      }

      if (!sourceId) {
        toast.error('Please select or create a source');
        setLoading(false);
        return;
      }

      const body = {
        sourceId,
        citationDetail: citationDetail.trim() || undefined,
        citationText: citationText.trim() || undefined,
        confidence,
        personId: personId || undefined,
        eventId: eventId || undefined,
        familyId: familyId || undefined,
      };

      const res = await fetch('/api/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to create citation');
        return;
      }

      toast.success('Citation added');
      onSave?.();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  const selectClass =
    'flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4">
      {/* Source selector */}
      <div className="space-y-1">
        <Label htmlFor="cf-source" className="text-xs">Source</Label>
        {selectedSource ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{selectedSource.title}</span>
            <button
              type="button"
              onClick={handleClearSource}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"
              title="Clear source"
            >
              &times;
            </button>
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <Input
              id="cf-source"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sources..."
              autoComplete="off"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover p-1 shadow-md">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSource(s)}
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{s.title}</span>
                    {s.author && (
                      <span className="ml-1 text-muted-foreground">by {s.author}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchResults.length === 0 && searchTerm.length >= 2 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover p-2 shadow-md">
                <p className="text-sm text-muted-foreground">No sources found</p>
              </div>
            )}
            {!showNewSourceForm && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setShowNewSourceForm(true);
                  setShowDropdown(false);
                }}
              >
                + Create new source
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Inline new source form */}
      {showNewSourceForm && !selectedSource && (
        <div className="space-y-2 rounded border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">New Source</p>
          <div className="space-y-1">
            <Label htmlFor="cf-ns-title" className="text-xs">Title *</Label>
            <Input
              id="cf-ns-title"
              value={newSourceTitle}
              onChange={(e) => setNewSourceTitle(e.target.value)}
              placeholder="Source title"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="cf-ns-author" className="text-xs">Author</Label>
              <Input
                id="cf-ns-author"
                value={newSourceAuthor}
                onChange={(e) => setNewSourceAuthor(e.target.value)}
                placeholder="Author name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cf-ns-type" className="text-xs">Type</Label>
              <select
                id="cf-ns-type"
                value={newSourceType}
                onChange={(e) => setNewSourceType(e.target.value)}
                className={selectClass}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowNewSourceForm(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Citation detail */}
      <div className="space-y-1">
        <Label htmlFor="cf-detail" className="text-xs">Citation Detail</Label>
        <Input
          id="cf-detail"
          value={citationDetail}
          onChange={(e) => setCitationDetail(e.target.value)}
          placeholder="Page 5, Line 12"
        />
      </div>

      {/* Citation text */}
      <div className="space-y-1">
        <Label htmlFor="cf-text" className="text-xs">Citation Text</Label>
        <Textarea
          id="cf-text"
          value={citationText}
          onChange={(e) => setCitationText(e.target.value)}
          placeholder="Full formatted citation"
          rows={2}
        />
      </div>

      {/* Confidence */}
      <div className="space-y-1">
        <Label htmlFor="cf-confidence" className="text-xs">Confidence</Label>
        <select
          id="cf-confidence"
          value={confidence}
          onChange={(e) => setConfidence(e.target.value as typeof confidence)}
          className={selectClass}
        >
          {CONFIDENCE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving...' : 'Add Citation'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
