'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Copy, Loader2, Mail, MoreHorizontal, RefreshCcw, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  familyId: string;
}

function formatExpiry(iso: string): { label: string; warn: boolean } {
  try {
    const ms = new Date(iso).getTime() - Date.now();
    const warn = ms > 0 && ms < 24 * 60 * 60 * 1000;
    return { label: formatDistanceToNow(new Date(iso), { addSuffix: true }), warn };
  } catch {
    return { label: iso, warn: false };
  }
}

export function FamilyPendingInvitations({ familyId }: Props) {
  const router = useRouter();
  const hydrated = useIsHydrated();
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; label: string } | null>(null);

  const query = trpc.platformAdmin.listInvitations.useQuery({
    familyId,
    status: 'pending',
  });

  // Gate fetch-status with `hydrated` so SSR and the first client paint
  // produce identical attribute output (the SSR pass evaluates this
  // differently from the post-hydration client and warns on `disabled`
  // and the icon swap).
  const showFetching = hydrated && query.isFetching;

  const revoke = trpc.platformAdmin.revokeInvite.useMutation({
    onSuccess: ({ revoked }) => {
      toast.success(revoked ? 'Invitation revoked' : 'Invitation already revoked');
      setRevokeTarget(null);
      query.refetch();
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to revoke invitation'),
  });

  const items = query.data ?? [];

  async function copyLink(token: string) {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Pending invitations
            {items.length > 0 ? (
              <span className="ml-2 text-xs text-muted-foreground">
                ({items.length})
              </span>
            ) : null}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => query.refetch()}
            disabled={showFetching}
            aria-label="Refresh"
          >
            {showFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="py-6 text-center">
              <Loader2 className="size-5 animate-spin inline-block text-muted-foreground" />
            </div>
          ) : query.isError ? (
            <div className="py-4 text-center">
              <p className="text-sm text-destructive">
                {query.error?.message ?? 'Failed to load invitations'}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => query.refetch()}>
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No pending invitations.
            </p>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="w-[100px]">Role</TableHead>
                    <TableHead className="w-[160px]">Expires</TableHead>
                    <TableHead className="w-[180px]">Invited by</TableHead>
                    <TableHead className="w-[60px]" aria-label="Actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((inv) => {
                    const expiry = formatExpiry(inv.expiresAt);
                    const recipient = inv.email ?? 'Anyone with link';
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[18rem]">{recipient}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {inv.role}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={
                            expiry.warn
                              ? 'text-destructive text-sm'
                              : 'text-muted-foreground text-sm'
                          }
                          title={inv.expiresAt}
                        >
                          {expiry.label}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.inviterName ?? '—'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Actions for invitation to ${recipient}`}
                                disabled={revoke.isPending}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => copyLink(inv.token)}>
                                <Copy className="size-4 mr-2" />
                                Copy invite link
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setRevokeTarget({ id: inv.id, label: recipient })
                                }
                              >
                                <Trash2 className="size-4 mr-2" />
                                Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The invitation link to <strong>{revokeTarget?.label}</strong> will
              stop working immediately. Anyone who hasn&rsquo;t accepted yet will
              not be able to use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (revokeTarget) {
                  revoke.mutate({ familyId, invitationId: revokeTarget.id });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoke.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Revoking…
                </>
              ) : (
                'Revoke'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
