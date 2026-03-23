'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Role } from '@ancstra/auth';
import { Button } from '@/components/ui/button';
import { RoleBadge } from '@/components/auth/role-badge';
import { Card } from '@/components/ui/card';
import { Check, Copy, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  familyId: string;
  email: string | null;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface PendingInvitesProps {
  familyId: string;
}

export function PendingInvites({ familyId }: PendingInvitesProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/families/${familyId}/invitations`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to load invitations');
      }
      const data: Invitation[] = await res.json();
      setInvitations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  async function handleRevoke(invitationId: string) {
    setRevokingId(invitationId);
    try {
      const res = await fetch(
        `/api/families/${familyId}/invitations?id=${invitationId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to revoke invitation');
      }
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      toast.success('Invitation revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke invitation');
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopyLink(invitation: Invitation) {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/invite/${invitation.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invitation.id);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Pending Invitations</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Pending Invitations</h2>
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchInvitations}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Pending Invitations</h2>

      {invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No pending invitations.
        </p>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => {
            const expiresDate = new Date(invitation.expiresAt);
            const isExpiringSoon =
              expiresDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

            return (
              <Card key={invitation.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {invitation.email ?? 'Anyone with link'}
                    </p>
                    <p
                      className={`text-xs ${
                        isExpiringSoon
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Expires {expiresDate.toLocaleDateString()}
                    </p>
                  </div>
                  <RoleBadge role={invitation.role as Role} />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopyLink(invitation)}
                    title="Copy invite link"
                    aria-label="Copy invite link"
                  >
                    {copiedId === invitation.id ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(invitation.id)}
                    disabled={revokingId === invitation.id}
                    title="Revoke invitation"
                    aria-label="Revoke invitation"
                  >
                    {revokingId === invitation.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
