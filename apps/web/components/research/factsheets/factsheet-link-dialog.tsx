'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { classifyApiError } from '@/lib/api/classify-error';
import {
  FACTSHEET_ENTITY_TYPE_LABELS,
  FACTSHEET_STATUS_CONFIG,
} from '@/lib/research/constants';
import type { Factsheet, FactsheetLink } from '@/lib/research/factsheet-client';
import {
  validateFactsheetLink,
  formatFactsheetViolation,
  DEFAULT_LINK_TYPE,
} from '@/lib/research/validate-factsheet-link';

interface FactsheetLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factsheet: Factsheet;
  /** Pool of candidate factsheets (graph view passes its FactsheetWithCounts which is a superset). */
  allFactsheets: readonly Factsheet[];
  existingLinks: readonly FactsheetLink[];
  onLinked?: () => void;
}

function getInitials(title: string): string {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

export function FactsheetLinkDialog({
  open,
  onOpenChange,
  factsheet,
  allFactsheets,
  existingLinks,
  onLinked,
}: FactsheetLinkDialogProps) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<Factsheet | null>(null);
  const [linking, setLinking] = useState(false);
  const [violationMessage, setViolationMessage] = useState<string | null>(null);

  // Reset on open transitions
  useEffect(() => {
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setSelected(null);
      setViolationMessage(null);
    }
  }, [open]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!selected) {
      setViolationMessage(null);
      return;
    }
    const violation = validateFactsheetLink({
      source: factsheet.id,
      target: selected.id,
      links: existingLinks,
    });
    setViolationMessage(violation ? formatFactsheetViolation(violation) : null);
  }, [selected, existingLinks, factsheet.id]);

  const filtered = useMemo(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();
    return allFactsheets
      .filter((fs) => fs.id !== factsheet.id)
      .filter((fs) => fs.status !== 'dismissed' && fs.status !== 'merged')
      .filter((fs) => {
        if (!trimmed) return true;
        return fs.title.toLowerCase().includes(trimmed);
      })
      .filter((fs) => {
        // Hide candidates that are already linked, regardless of relationship type.
        const violation = validateFactsheetLink({
          source: factsheet.id,
          target: fs.id,
          links: existingLinks,
        });
        return violation?.kind !== 'duplicate';
      })
      .slice(0, 20);
  }, [allFactsheets, factsheet.id, debouncedQuery, existingLinks]);

  const handleLink = useCallback(async () => {
    if (!selected) return;
    const violation = validateFactsheetLink({
      source: factsheet.id,
      target: selected.id,
      links: existingLinks,
    });
    if (violation) {
      setViolationMessage(formatFactsheetViolation(violation));
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(`/api/research/factsheets/${factsheet.id}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toFactsheetId: selected.id,
          relationshipType: DEFAULT_LINK_TYPE,
          confidence: 'high',
        }),
      });
      if (!res.ok) {
        toast.error(classifyApiError(res));
        return;
      }
      toast.success(`Linked ${selected.title}`);
      onOpenChange(false);
      onLinked?.();
    } catch {
      toast.error('Network error — check your connection');
    } finally {
      setLinking(false);
    }
  }, [selected, factsheet.id, existingLinks, onOpenChange, onLinked]);

  const content = (
    <div className="flex flex-col">
      {selected ? (
        <div className="space-y-4 p-4">
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Confirm link
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 rounded-lg border bg-background p-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {getInitials(factsheet.title)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{factsheet.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Current · {FACTSHEET_ENTITY_TYPE_LABELS[factsheet.entityType] ?? factsheet.entityType}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-6">
                <div className="h-px flex-1 bg-border" />
                <Link2 className="size-3 shrink-0 text-muted-foreground" />
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/[0.04] p-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {getInitials(selected.title)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{selected.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {FACTSHEET_ENTITY_TYPE_LABELS[selected.entityType] ?? selected.entityType}
                    {' · '}
                    {(FACTSHEET_STATUS_CONFIG[selected.status] ?? FACTSHEET_STATUS_CONFIG.draft).label}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {violationMessage && (
            <p className="text-xs text-destructive">{violationMessage}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelected(null);
                setViolationMessage(null);
              }}
              disabled={linking}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={handleLink}
              disabled={linking || violationMessage !== null}
            >
              {linking ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Linking…
                </>
              ) : (
                <>
                  <Link2 className="mr-1.5 size-3.5" />
                  Confirm Link
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Command shouldFilter={false} className="rounded-xl!">
          <CommandInput
            placeholder="Search factsheets by title…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-64 md:max-h-72">
            {filtered.length === 0 ? (
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-4">
                  <Search className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {debouncedQuery.trim()
                      ? 'No matching factsheets'
                      : 'No factsheets available to link'}
                  </p>
                </div>
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((fs) => {
                  const statusCfg = FACTSHEET_STATUS_CONFIG[fs.status] ?? FACTSHEET_STATUS_CONFIG.draft;
                  return (
                    <CommandItem
                      key={fs.id}
                      value={fs.id}
                      onSelect={() => setSelected(fs)}
                      className="flex cursor-pointer items-center gap-3 px-2 py-2.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {getInitials(fs.title)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{fs.title}</span>
                          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${statusCfg.className}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {FACTSHEET_ENTITY_TYPE_LABELS[fs.entityType] ?? fs.entityType}
                        </p>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Link2 className="size-4" />
              Link factsheet
            </DrawerTitle>
            <DrawerDescription>
              Connect this factsheet to another in the same workspace.
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Link factsheet
          </DialogTitle>
          <DialogDescription>
            Connect this factsheet to another in the same workspace.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
