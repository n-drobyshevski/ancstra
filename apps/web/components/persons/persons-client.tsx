'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PersonTable } from '@/components/person-table';
import type { PersonListItem } from '@ancstra/shared';

interface PersonsClientProps {
  initialPersons: PersonListItem[];
  initialTotal: number;
  initialQuery: string;
  initialPage: number;
  pageSize: number;
}

export function PersonsClient({
  initialPersons,
  initialTotal,
  initialQuery,
  initialPage,
  pageSize,
}: PersonsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [persons, setPersons] = useState<PersonListItem[]>(initialPersons);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [hasClientFetched, setHasClientFetched] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedQuery) params.set('q', debouncedQuery);

    try {
      const res = await fetch(`/api/persons?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPersons(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, pageSize]);

  // Only fetch client-side when query/page changes AFTER initial render
  useEffect(() => {
    if (!hasClientFetched) {
      setHasClientFetched(true);
      return;
    }
    fetchPersons();
  }, [fetchPersons, hasClientFetched]);

  // Update URL params on search/paginate
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (page > 1) params.set('page', String(page));
    const paramString = params.toString();
    const newUrl = paramString ? `/persons?${paramString}` : '/persons';

    const currentParams = searchParams.toString();
    if (paramString !== currentParams) {
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedQuery, page, router, searchParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Input
        placeholder="Search by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <PersonTable persons={persons} />
          {total > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
