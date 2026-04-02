// apps/web/components/research/smart-suggestions.tsx
'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSuggestions, getFallbackSuggestions, type SearchSuggestion } from '@/lib/research/suggestions';

interface SmartSuggestionsProps {
  onSelect: (query: string) => void;
}

export function SmartSuggestions({ onSelect }: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSuggestions(5).then((results) => {
      if (cancelled) return;
      if (results.length > 0) {
        setSuggestions(results);
      } else {
        setFallbacks(getFallbackSuggestions());
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-col gap-1" aria-busy="true">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2">
            <Skeleton className="size-3.5 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (suggestions.length > 0) {
    return (
      <div className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <button
            key={s.personId}
            type="button"
            onClick={() => onSelect(s.query)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
          >
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <span className="text-foreground">{s.query}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                Missing: {s.missingTypes.join(', ')}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {fallbacks.map((query) => (
        <button
          key={query}
          type="button"
          onClick={() => onSelect(query)}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-foreground">{query}</span>
        </button>
      ))}
    </div>
  );
}
