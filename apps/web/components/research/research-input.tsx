'use client';

import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Search, X, Link, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScrapeUrl } from '@/lib/research/scrape-client';
import {
  getRecentSearches,
  removeSearch,
  clearHistory,
  EXAMPLE_SEARCHES,
} from '@/lib/research/search-history';

const URL_REGEX = /^https?:\/\//;

export interface ResearchInputHandle {
  focusUrlMode: () => void;
  focus: () => void;
}

interface ResearchInputProps {
  onSearch: (query: string) => void;
  onBookmark?: () => void;
  onOpenTextModal?: () => void;
  placeholder?: string;
  externalQuery?: string;
}

export const ResearchInput = forwardRef<ResearchInputHandle, ResearchInputProps>(
  function ResearchInput({
    onSearch,
    onBookmark,
    onOpenTextModal,
    placeholder = 'Search records or paste a URL...',
    externalQuery,
  }, ref) {
  const [value, setValue] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { scrape, status, result, error, isLoading, elapsed, reset } = useScrapeUrl();

  useImperativeHandle(ref, () => ({
    focusUrlMode() {
      setValue('https://');
      setIsUrlMode(true);
      inputRef.current?.focus();
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (input) input.setSelectionRange(input.value.length, input.value.length);
      });
    },
    focus() {
      inputRef.current?.focus();
    },
  }));

  // Sync external query (e.g. from example search clicks)
  useEffect(() => {
    if (externalQuery != null) {
      setValue(externalQuery);
      setShowDropdown(false);
    }
  }, [externalQuery]);

  // Auto-detect URL vs search
  useEffect(() => {
    const trimmed = value.trim();
    setIsUrlMode(URL_REGEX.test(trimmed));
  }, [value]);

  // Load recent searches when dropdown opens
  useEffect(() => {
    if (showDropdown) setRecentSearches(getRecentSearches());
  }, [showDropdown]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  // Submit search on Enter or button click
  const handleSubmitSearch = useCallback(() => {
    if (isUrlMode) return;
    setShowDropdown(false);
    onSearch(value.trim());
  }, [value, isUrlMode, onSearch]);

  // Select a suggestion from the dropdown
  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setValue(suggestion);
    setShowDropdown(false);
    onSearch(suggestion);
  }, [onSearch]);

  const handleScrape = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const res = await scrape(trimmed);
    if (res) {
      onBookmark?.();
    }
  }, [value, scrape, onBookmark]);

  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
  }, [onSearch]);

  const isDone = status === 'done';
  const hasValue = value.length > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (!URL_REGEX.test(e.target.value.trim())) setShowDropdown(true);
            else setShowDropdown(false);
          }}
          onFocus={() => { if (!isUrlMode && !isLoading) setShowDropdown(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmitSearch();
            if (e.key === 'Escape') setShowDropdown(false);
          }}
          placeholder={placeholder}
          className="pl-9 pr-24"
          disabled={isLoading}
          aria-label="Search records or paste a URL"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
          {hasValue && !isUrlMode ? (
            <button
              type="button"
              onClick={handleSubmitSearch}
              className="rounded-md bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              disabled={isLoading}
              aria-label="Search"
            >
              Search
            </button>
          ) : null}
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && !isUrlMode && !isLoading && (
          <SuggestionDropdown
            ref={dropdownRef}
            query={value.trim()}
            recentSearches={recentSearches}
            onSelect={handleSelectSuggestion}
            onRemoveRecent={(q) => {
              removeSearch(q);
              setRecentSearches(getRecentSearches());
            }}
            onClearHistory={() => {
              clearHistory();
              setRecentSearches([]);
            }}
          />
        )}
      </div>

      {/* Hint text — only when empty and idle */}
      {!hasValue && status === 'idle' && (
        <p className="text-center text-xs text-muted-foreground/60">
          Tip: paste any URL to auto-scrape it
        </p>
      )}

      {/* URL confirmation card */}
      {isUrlMode && hasValue && !isDone && status !== 'timeout' && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <Link className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">{value.trim()}</p>
          </div>
          {isLoading && (
            <span className="text-xs tabular-nums text-muted-foreground">{elapsed}s</span>
          )}
          <Button
            size="sm"
            onClick={handleScrape}
            disabled={isLoading}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Scraping...
              </>
            ) : (
              'Scrape & Bookmark'
            )}
          </Button>
        </div>
      )}

      {/* Timeout state */}
      {status === 'timeout' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-sm text-destructive">
            Scraping took too long. The page may be slow or unreachable.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleScrape}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Success state */}
      {isDone && result && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <CheckCircle2 className="size-4 shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{result.title}</p>
          </div>
          <Badge variant="secondary">Bookmarked</Badge>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-2">
          <p className="text-sm text-destructive">{error.message}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleScrape}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

/* ── Suggestion dropdown ── */

interface SuggestionDropdownProps {
  query: string;
  recentSearches: string[];
  onSelect: (suggestion: string) => void;
  onRemoveRecent: (query: string) => void;
  onClearHistory: () => void;
}

const SuggestionDropdown = React.forwardRef<HTMLDivElement, SuggestionDropdownProps>(
  function SuggestionDropdown({ query, recentSearches, onSelect, onRemoveRecent, onClearHistory }, ref) {
    const lowerQuery = query.toLowerCase();

    const filteredRecent = lowerQuery
      ? recentSearches.filter((s) => s.toLowerCase().includes(lowerQuery))
      : recentSearches;

    const filteredExamples = lowerQuery
      ? EXAMPLE_SEARCHES.filter((s) => s.toLowerCase().includes(lowerQuery) && !recentSearches.includes(s))
      : EXAMPLE_SEARCHES.filter((s) => !recentSearches.includes(s));

    if (filteredRecent.length === 0 && filteredExamples.length === 0) return null;

    return (
      <div
        ref={ref}
        className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md"
      >
        {filteredRecent.length > 0 && (
          <div className="p-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">Recent</span>
              {!lowerQuery && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); onClearHistory(); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>
            {filteredRecent.map((search) => (
              <button
                key={search}
                type="button"
                onClick={() => onSelect(search)}
                className="group flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-left">{search}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onRemoveRecent(search); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemoveRecent(search); } }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove "${search}" from history`}
                >
                  <X className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
        {filteredExamples.length > 0 && (
          <div className="p-1">
            {filteredRecent.length > 0 && <div className="mx-2 mb-1 border-t border-border" />}
            <div className="px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">Try searching for</span>
            </div>
            {filteredExamples.map((search) => (
              <button
                key={search}
                type="button"
                onClick={() => onSelect(search)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-left">{search}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
