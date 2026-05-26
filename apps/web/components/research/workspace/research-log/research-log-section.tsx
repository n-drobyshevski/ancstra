'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSearchAttempts, type SearchAttempt } from '@/hooks/use-search-attempts';
import { SearchAttemptList } from './search-attempt-list';
import { SearchAttemptForm } from './search-attempt-form';
import { DeleteSearchAttemptDialog } from './delete-search-attempt-dialog';

interface ResearchLogSectionProps {
  personId: string;
}

/**
 * Bundle E 2026-05-26 — Research log tab content root.
 *
 * Owns the list-fetch hook, the add/edit dialog state, and the delete
 * confirmation state. Submission paths all call refetch() so list + tab
 * badge update without manual page reload.
 *
 * See: docs/superpowers/specs/2026-05-26-research-flow-unification-bundle-e-design.md §4.
 */
export function ResearchLogSection({ personId }: ResearchLogSectionProps) {
  const t = useTranslations('persons.researchLog');
  const { items, isLoading, error, refetch } = useSearchAttempts(personId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SearchAttempt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SearchAttempt | null>(null);

  const openCreate = useCallback(() => { setEditing(null); setFormOpen(true); }, []);
  const openEdit = useCallback((a: SearchAttempt) => { setEditing(a); setFormOpen(true); }, []);
  const openDelete = useCallback((a: SearchAttempt) => { setDeleteTarget(a); }, []);

  const handleSubmitted = useCallback(async (_attempt: SearchAttempt) => {
    setFormOpen(false);
    setEditing(null);
    await refetch();
  }, [refetch]);

  const handleDeleted = useCallback(async (_attemptId: string) => {
    setDeleteTarget(null);
    await refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('tabLabel')}</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('addButton')}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <SearchAttemptList
          personId={personId}
          items={items}
          onEdit={openEdit}
          onDelete={openDelete}
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('editAction') : t('addButton')}
            </DialogTitle>
          </DialogHeader>
          <SearchAttemptForm
            mode={editing ? 'edit' : 'create'}
            personId={personId}
            initialValue={editing ?? undefined}
            onSubmitted={handleSubmitted}
            onCancel={() => { setFormOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <DeleteSearchAttemptDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        attempt={deleteTarget}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
