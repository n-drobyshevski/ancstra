'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { SourceForm } from '@/components/source-form';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { Source } from '@ancstra/shared';

const TYPE_LABELS: Record<string, string> = {
  vital_record: 'Vital Record',
  census: 'Census',
  military: 'Military',
  church: 'Church',
  newspaper: 'Newspaper',
  immigration: 'Immigration',
  land: 'Land',
  probate: 'Probate',
  cemetery: 'Cemetery',
  photograph: 'Photograph',
  personal_knowledge: 'Personal Knowledge',
  correspondence: 'Correspondence',
  book: 'Book',
  online: 'Online',
  other: 'Other',
};

export default function SourcesPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const pageSize = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedQuery) params.set('q', debouncedQuery);

    try {
      const res = await fetch(`/api/sources?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSources(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleSaved() {
    setShowAddForm(false);
    setEditingId(null);
    fetchSources();
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete source');
      }
      toast.success('Source deleted');
      fetchSources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete source');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sources</h1>
        <Button onClick={() => { setShowAddForm((v) => !v); setEditingId(null); }}>
          {showAddForm ? 'Cancel' : 'Add Source'}
        </Button>
      </div>

      {showAddForm && (
        <SourceForm
          onSave={handleSaved}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <Input
        placeholder="Search sources..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead className="text-right">Citations</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No sources found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sources.map((source) => (
                    editingId === source.id ? (
                      <TableRow key={source.id}>
                        <TableCell colSpan={5}>
                          <SourceForm
                            source={source}
                            onSave={handleSaved}
                            onCancel={() => setEditingId(null)}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={source.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-medium text-primary hover:underline"
                            onClick={() => { setEditingId(source.id); setShowAddForm(false); }}
                          >
                            {source.title}
                          </button>
                        </TableCell>
                        <TableCell>
                          {source.sourceType && (
                            <Badge variant="secondary">
                              {TYPE_LABELS[source.sourceType] ?? source.sourceType}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {source.repositoryName ?? ''}
                        </TableCell>
                        <TableCell className="text-right">
                          {source.citationCount ?? 0}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete source?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &ldquo;{source.title}&rdquo; and cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(source.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    )
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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
    </div>
  );
}
