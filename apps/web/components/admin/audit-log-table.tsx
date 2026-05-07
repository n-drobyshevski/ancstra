'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Loader2, RefreshCcw, X } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AuditEntry = {
  id: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  actorAvatarUrl: string | null;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const TARGET_TYPE_OPTIONS = [
  { value: 'all', label: 'All targets' },
  { value: 'user', label: 'User' },
  { value: 'family', label: 'Family' },
] as const;

function initials(name: string, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

function formatWhen(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function AuditLogTable() {
  const hydrated = useIsHydrated();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);

  const queryInput = useMemo(
    () => ({
      limit: 50,
      action: actionFilter === 'all' ? undefined : actionFilter,
      targetType:
        targetTypeFilter === 'all'
          ? undefined
          : (targetTypeFilter as 'user' | 'family'),
      actorUserId: actorFilter.trim() || undefined,
    }),
    [actionFilter, targetTypeFilter, actorFilter],
  );

  const query = trpc.platformAdmin.listAuditLog.useInfiniteQuery(queryInput, {
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const actionsQuery = trpc.platformAdmin.listAuditLogActions.useQuery();

  const items: AuditEntry[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const hasFilters =
    actionFilter !== 'all' || targetTypeFilter !== 'all' || actorFilter.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="audit-action">
            Action
          </label>
          <Select
            value={actionFilter}
            onValueChange={setActionFilter}
            disabled={hydrated && actionsQuery.isLoading}
          >
            <SelectTrigger id="audit-action" className="w-[220px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {(actionsQuery.data ?? []).map((a) => (
                <SelectItem key={a} value={a}>
                  <code className="text-xs">{a}</code>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="audit-target-type">
            Target type
          </label>
          <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
            <SelectTrigger id="audit-target-type" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="audit-actor">
            Actor user ID
          </label>
          <Input
            id="audit-actor"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Filter by actor user ID…"
            className="w-[260px]"
          />
        </div>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter('all');
              setTargetTypeFilter('all');
              setActorFilter('');
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {items.length} entr{items.length === 1 ? 'y' : 'ies'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => query.refetch()}
            disabled={hydrated && query.isFetching}
            aria-label="Refresh"
          >
            {hydrated && query.isFetching && !query.isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">When</TableHead>
              <TableHead className="w-[220px]">Actor</TableHead>
              <TableHead className="w-[200px]">Action</TableHead>
              <TableHead className="w-[180px]">Target</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="w-[60px]" aria-label="Details" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Loader2 className="size-5 animate-spin inline-block text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : query.isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="text-sm text-destructive">
                    {query.error?.message ?? 'Failed to load audit log'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => query.refetch()}
                  >
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {hasFilters
                    ? 'No entries match the selected filters.'
                    : 'No audit entries yet.'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell
                    className="text-xs text-muted-foreground"
                    title={entry.createdAt}
                  >
                    {formatWhen(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/users/${entry.actorUserId}`}
                      className="flex items-center gap-2 hover:underline focus:underline focus:outline-none"
                    >
                      <Avatar className="size-6 shrink-0">
                        {entry.actorAvatarUrl ? (
                          <AvatarImage src={entry.actorAvatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {initials(entry.actorName, entry.actorEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[10rem]">{entry.actorName}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs rounded bg-muted px-1.5 py-0.5">
                      {entry.action}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="capitalize">
                        {entry.targetType}
                      </Badge>
                      <Link
                        href={
                          entry.targetType === 'user'
                            ? `/admin/users/${entry.targetId}`
                            : entry.targetType === 'family'
                              ? `/admin/families/${entry.targetId}`
                              : '#'
                        }
                        className="text-xs font-mono truncate max-w-[8rem] hover:underline"
                        title={entry.targetId}
                      >
                        {entry.targetId.slice(0, 8)}…
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{entry.summary}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDetailEntry(entry)}
                      aria-label="View entry details"
                      disabled={!entry.metadata}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      ) : null}

      <Sheet
        open={!!detailEntry}
        onOpenChange={(o) => !o && setDetailEntry(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Audit entry details</SheetTitle>
            <SheetDescription>
              <code className="text-xs">{detailEntry?.action}</code>
            </SheetDescription>
          </SheetHeader>
          {detailEntry ? (
            <div className="mt-6 space-y-4 px-4 pb-6 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">When</dt>
                <dd className="font-medium tabular-nums">{detailEntry.createdAt}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Actor</dt>
                <dd>
                  {detailEntry.actorName}{' '}
                  <span className="text-muted-foreground">({detailEntry.actorEmail})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Target</dt>
                <dd>
                  <Badge variant="outline" className="capitalize mr-1.5">
                    {detailEntry.targetType}
                  </Badge>
                  <code className="text-xs">{detailEntry.targetId}</code>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Summary</dt>
                <dd>{detailEntry.summary}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Metadata</dt>
                <dd>
                  {detailEntry.metadata ? (
                    <pre className="mt-1 rounded-md border bg-muted/50 p-3 text-xs overflow-x-auto">
                      {JSON.stringify(detailEntry.metadata, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
